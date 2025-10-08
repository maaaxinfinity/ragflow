# 02 - FreeChat设置API详解

**模块**: `api/apps/free_chat_app.py`  
**功能**: 用户设置管理与Redis缓存  
**代码行数**: 361行  
**端点数量**: 4个API端点

---

## 📋 目录

1. [模块概述](#模块概述)
2. [Redis缓存策略](#redis缓存策略)
3. [团队访问验证](#团队访问验证)
4. [API端点详解](#api端点详解)
5. [Admin Token机制](#admin-token机制)
6. [数据流与时序图](#数据流与时序图)

---

## 模块概述

### Blueprint注册

```python
from flask import Blueprint
manager = Blueprint('free_chat', __name__)
```

**路由前缀**: `/v1/free_chat`

### 核心功能

1. **用户设置管理** - CRUD操作
2. **Redis缓存** - 双层存储策略（L1: Redis, L2: MySQL）
3. **团队访问控制** - 多租户权限验证
4. **Admin Token获取** - 支持iframe嵌入认证

---

## Redis缓存策略

### 缓存架构

```
┌─────────────────────────────────────────────┐
│         Client Request                      │
└─────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│   L1 Cache: Redis                           │
│   - Key: freechat:sessions:{user_id}       │
│   - TTL: 7 days                             │
│   - Data: sessions列表（JSON）              │
└─────────────────────────────────────────────┘
                  ↓ Cache Miss
┌─────────────────────────────────────────────┐
│   L2 Storage: MySQL                         │
│   - Table: free_chat_user_settings          │
│   - Persistent: 永久存储                     │
│   - Data: 完整settings对象                  │
└─────────────────────────────────────────────┘
```

### 缓存Key设计

```python
REDIS_SESSION_KEY_PREFIX = "freechat:sessions:"
REDIS_SESSION_TTL = 7 * 24 * 60 * 60  # 7 days

# 完整Key格式
key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
# 示例: "freechat:sessions:external_user_123"
```

### 缓存函数

#### 1. get_sessions_from_redis()

```python
def get_sessions_from_redis(user_id: str):
    """Get sessions from Redis cache (L1 cache)"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        data = REDIS_CONN.get(key)
        if data:
            return json.loads(data)  # 反序列化JSON
    except Exception as e:
        logging.warning(f"[FreeChat] Redis get failed for user {user_id}: {e}")
    return None  # Cache miss or error
```

**返回值**：
- `None` - 缓存未命中或错误
- `list` - sessions列表（已反序列化）

#### 2. save_sessions_to_redis()

```python
def save_sessions_to_redis(user_id: str, sessions: list):
    """Save sessions to Redis cache with TTL"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        REDIS_CONN.set_obj(key, sessions, REDIS_SESSION_TTL)
        logging.info(f"[FreeChat] Cached sessions to Redis for user {user_id}")
    except Exception as e:
        logging.error(f"[FreeChat] Redis save failed for user {user_id}: {e}")
```

**REDIS_CONN.set_obj()实现**：
```python
# rag/utils/redis_conn.py
def set_obj(self, key, value, ttl=None):
    serialized = json.dumps(value, ensure_ascii=False)
    if ttl:
        self.redis.setex(key, ttl, serialized)
    else:
        self.redis.set(key, serialized)
```

#### 3. invalidate_sessions_cache()

```python
def invalidate_sessions_cache(user_id: str):
    """Invalidate Redis cache for user"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        REDIS_CONN.delete(key)
        logging.info(f"[FreeChat] Invalidated Redis cache for user {user_id}")
    except Exception as e:
        logging.error(f"[FreeChat] Redis delete failed for user {user_id}: {e}")
```

### 缓存使用场景

| 场景 | Redis | MySQL | 说明 |
|------|-------|-------|------|
| **读取** | ✅ 优先读取 | ⚠️ Cache Miss时读取 | 快速响应 |
| **保存** | ✅ 立即写入 | ✅ 随后持久化 | 双写保证 |
| **删除** | ✅ 同时删除 | ✅ 同时删除 | 一致性 |
| **失败** | ⚠️ 降级到MySQL | ✅ 始终可用 | 容错机制 |

---

## 团队访问验证

### verify_team_access() 函数

```python
def verify_team_access(user_id: str, current_tenant_id: str = None) -> tuple[bool, str]:
    """
    Verify if the user_id has access within the current team/tenant.
    
    规则：
    1. 首次访问用户（无设置记录）→ 允许
    2. 已有设置的用户 → 验证dialog_id是否属于当前租户
    3. 验证失败 → 拒绝访问
    
    Returns:
        (is_authorized, error_message)
    """
    try:
        # 获取current_tenant_id（如果未提供）
        if not current_tenant_id:
            if current_user and current_user.is_authenticated:
                tenants = UserTenantService.query(user_id=current_user.id)
                if not tenants:
                    return False, "User not associated with any tenant"
                current_tenant_id = tenants[0].tenant_id
            else:
                return False, "Authentication required"

        # 检查用户设置是否存在
        exists, setting = FreeChatUserSettingsService.get_by_user_id(user_id)
        
        if exists and setting.dialog_id and setting.dialog_id.strip():
            # 验证dialog是否属于当前租户
            dialogs = DialogService.query(
                id=setting.dialog_id, 
                tenant_id=current_tenant_id
            )
            if not dialogs:  # dialogs是列表，空列表表示未找到
                return False, "User does not belong to your team"
        
        # 首次访问或无dialog_id → 允许
        return True, ""
    
    except Exception as e:
        return False, f"Authorization check failed: {str(e)}"
```

### 验证逻辑流程图

```
用户请求
  ↓
┌──────────────────────────────────────┐
│ 1. 获取current_tenant_id             │
│    - API Key: 从kwargs获取           │
│    - Session: 从current_user获取     │
└──────────────────────────────────────┘
  ↓
┌──────────────────────────────────────┐
│ 2. 查询用户设置                      │
│    FreeChatUserSettingsService       │
│    .get_by_user_id(user_id)         │
└──────────────────────────────────────┘
  ↓
┌──────────────────────────────────────┐
│ 3. 判断是否首次访问                  │
└──────────────────────────────────────┘
  ↓                           ↓
[首次访问]                 [已有设置]
  ↓                           ↓
✅ 允许访问               ┌──────────────────┐
                         │ 4. 验证dialog所有权│
                         │ DialogService.query│
                         │ (id, tenant_id)    │
                         └──────────────────┘
                           ↓              ↓
                      [属于当前租户]  [不属于]
                           ↓              ↓
                      ✅ 允许访问     ❌ 拒绝访问
```

---

## API端点详解

### 1. GET /v1/free_chat/settings

**功能**: 获取用户的FreeChat设置

**请求示例**：
```http
GET /v1/free_chat/settings?user_id=external_user_123 HTTP/1.1
Host: ragflow.example.com
Authorization: Bearer ragflow-abc123def456
```

**代码实现**：
```python
@manager.route("/settings", methods=["GET"])
@api_key_or_login_required
def get_user_settings(**kwargs):
    try:
        user_id = request.args.get("user_id")
        if not user_id:
            return get_data_error_result(message="user_id is required")

        # 获取tenant_id
        auth_method = kwargs.get("auth_method")
        if auth_method == "api_key":
            current_tenant_id = kwargs.get("tenant_id")
        else:
            tenants = UserTenantService.query(user_id=current_user.id)
            if not tenants:
                return get_data_error_result(
                    message="User not associated with any tenant"
                )
            current_tenant_id = tenants[0].tenant_id

        # 团队访问验证
        is_authorized, error_msg = verify_team_access(user_id, current_tenant_id)
        if not is_authorized:
            return get_data_error_result(
                message=error_msg,
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

        # 尝试从Redis获取（L1缓存）
        cached_sessions = get_sessions_from_redis(user_id)

        # 从MySQL获取完整设置（L2存储）
        exists, setting = FreeChatUserSettingsService.get_by_user_id(user_id)
        
        if exists:
            result = setting.to_dict()
            # 优先使用Redis缓存的sessions
            if cached_sessions is not None:
                result['sessions'] = cached_sessions
                logging.info(f"[FreeChat] Loaded sessions from Redis for {user_id}")
            else:
                # Cache miss，缓存DB的sessions到Redis
                save_sessions_to_redis(user_id, result.get('sessions', []))
                logging.info(f"[FreeChat] Loaded sessions from MySQL for {user_id}")
            return get_json_result(data=result)
        else:
            # 首次访问，返回默认设置
            default_settings = {
                "user_id": user_id,
                "dialog_id": "",
                "model_params": {"temperature": 0.7, "top_p": 0.9},
                "kb_ids": [],
                "role_prompt": "",
                "sessions": []
            }
            save_sessions_to_redis(user_id, [])
            return get_json_result(data=default_settings)
    except Exception as e:
        return server_error_response(e)
```

**响应示例**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "user_id": "external_user_123",
    "dialog_id": "bot_456",
    "model_params": {
      "temperature": 0.7,
      "top_p": 0.9
    },
    "kb_ids": ["kb1", "kb2"],
    "role_prompt": "你是一个专业的法律顾问",
    "sessions": [
      {
        "id": "uuid-1",
        "conversation_id": "conv_abc",
        "model_card_id": 123,
        "name": "法律咨询",
        "messages": [...],
        "created_at": 1703001234567,
        "updated_at": 1703005678901
      }
    ]
  }
}
```

### 2. POST /v1/free_chat/settings

**功能**: 保存/更新用户设置

**请求示例**：
```json
POST /v1/free_chat/settings HTTP/1.1
Content-Type: application/json
Authorization: Bearer ragflow-abc123def456

{
  "user_id": "external_user_123",
  "dialog_id": "bot_456",
  "model_params": {
    "temperature": 0.8,
    "top_p": 0.95
  },
  "kb_ids": ["kb1", "kb3"],
  "role_prompt": "你是一位刑法专家",
  "sessions": [...]
}
```

**代码实现**：
```python
@manager.route("/settings", methods=["POST", "PUT"])
@api_key_or_login_required
@validate_request("user_id")
def save_user_settings(**kwargs):
    try:
        req = request.json
        user_id = req.get("user_id")

        # 获取tenant_id并验证权限
        auth_method = kwargs.get("auth_method")
        if auth_method == "api_key":
            current_tenant_id = kwargs.get("tenant_id")
        else:
            tenants = UserTenantService.query(user_id=current_user.id)
            if not tenants:
                return get_data_error_result(
                    message="User not associated with any tenant"
                )
            current_tenant_id = tenants[0].tenant_id

        is_authorized, error_msg = verify_team_access(user_id, current_tenant_id)
        if not is_authorized:
            return get_data_error_result(
                message=error_msg,
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

        # 提取设置数据
        data = {
            "dialog_id": req.get("dialog_id", ""),
            "model_params": req.get("model_params", {}),
            "kb_ids": req.get("kb_ids", []),
            "role_prompt": req.get("role_prompt", ""),
            "sessions": req.get("sessions", [])
        }

        # 验证dialog所有权
        if data["dialog_id"]:
            dialog = DialogService.query(
                id=data["dialog_id"], 
                tenant_id=current_tenant_id
            )
            if not dialog:
                return get_data_error_result(
                    message="Selected dialog does not belong to your team",
                    code=settings.RetCode.AUTHENTICATION_ERROR
                )

        # Step 1: 立即写入Redis（快速响应）
        sessions = data.get("sessions", [])
        save_sessions_to_redis(user_id, sessions)
        logging.info(f"[FreeChat] Saved sessions to Redis for {user_id}")

        # Step 2: 持久化到MySQL（保证durability）
        success, result = FreeChatUserSettingsService.upsert(user_id, **data)
        
        if success:
            logging.info(f"[FreeChat] Persisted settings to MySQL for {user_id}")
            return get_json_result(data=result.to_dict())
        else:
            # MySQL失败，使Redis失效（保证一致性）
            invalidate_sessions_cache(user_id)
            logging.error(f"[FreeChat] MySQL save failed, invalidated Redis")
            return get_data_error_result(message=f"Failed to save: {result}")
    except Exception as e:
        return server_error_response(e)
```

**双写策略**：
1. ✅ **立即写入Redis** - 快速响应，提升用户体验
2. ✅ **持久化到MySQL** - 保证数据durability
3. ⚠️ **失败时回滚** - MySQL失败时删除Redis缓存

### 3. DELETE /v1/free_chat/settings/{user_id}

**功能**: 删除用户设置

**请求示例**：
```http
DELETE /v1/free_chat/settings/external_user_123 HTTP/1.1
Cookie: session=...
```

**代码实现**：
```python
@manager.route("/settings/<user_id>", methods=["DELETE"])
@login_required  # 仅支持Session认证
def delete_user_settings(user_id):
    try:
        # 获取当前用户的租户
        tenants = UserTenantService.query(user_id=current_user.id)
        if not tenants:
            return get_data_error_result(
                message="User not associated with any tenant"
            )
        current_tenant_id = tenants[0].tenant_id

        # 团队访问验证
        is_authorized, error_msg = verify_team_access(user_id, current_tenant_id)
        if not is_authorized:
            return get_data_error_result(
                message=error_msg,
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

        # 删除MySQL记录
        success = FreeChatUserSettingsService.delete_by_user_id(user_id)
        
        if success:
            # 同时删除Redis缓存
            invalidate_sessions_cache(user_id)
            logging.info(f"[FreeChat] Deleted settings and cache for {user_id}")
            return get_json_result(data=True)
        else:
            return get_data_error_result(
                message="Failed to delete settings or user not found"
            )
    except Exception as e:
        return server_error_response(e)
```

**注意**：
- ⚠️ 仅支持`@login_required`（Session认证）
- ✅ 同时删除MySQL和Redis数据
- ✅ 删除前验证团队访问权限

---

## Admin Token机制

### GET /v1/free_chat/admin_token

**功能**: 获取当前用户的Admin API Token（Beta Token）

**使用场景**：
- iframe嵌入认证
- 第三方系统获取Token
- Mobile App认证

**SU（Super User）权限逻辑**：

```python
@manager.route("/admin_token", methods=["GET"])
def get_admin_token():
    try:
        # 支持两种认证方式
        user = None

        # 方式1: Authorization header中的access_token
        authorization_str = request.headers.get("Authorization")
        if authorization_str:
            parts = authorization_str.split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                access_token = parts[1]
                users = UserService.query(
                    access_token=access_token, 
                    status=StatusEnum.VALID.value
                )
                if users:
                    user = users[0]

        # 方式2: Flask-Login session
        if not user:
            if current_user and current_user.is_authenticated:
                user = current_user

        if not user:
            return get_data_error_result(
                message="Authentication required",
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

        # 确定tenant_id（核心逻辑）
        admin_email = os.environ.get("ADMIN_EMAIL")

        if admin_email:
            # 查找SU用户
            su_users = UserService.query(
                email=admin_email, 
                status=StatusEnum.VALID.value
            )

            if su_users:
                su_user = su_users[0]
                su_tenant_id = su_user.id  # SU的tenant_id = SU的user_id

                if user.id == su_user.id:
                    # 当前用户是SU
                    tenant_id = su_tenant_id
                    logging.info(f"User {user.id} is SU, using tenant {tenant_id}")
                else:
                    # 检查是否是SU团队成员
                    su_team_members = UserTenantService.get_by_tenant_id(su_tenant_id)
                    su_member_ids = [m["user_id"] for m in su_team_members]

                    if user.id in su_member_ids:
                        # 是团队成员 → 使用SU的tenant_id
                        tenant_id = su_tenant_id
                        logging.info(f"User {user.id} in SU team, using {tenant_id}")
                    else:
                        # 不是团队成员 → 拒绝访问
                        logging.warning(f"User {user.id} NOT in SU team, denied")
                        return get_data_error_result(
                            message="Access denied. Only team members can access.",
                            code=settings.RetCode.AUTHENTICATION_ERROR
                        )
            else:
                # SU未找到，使用用户自己的tenant
                tenants = UserTenantService.query(user_id=user.id)
                if not tenants:
                    return get_data_error_result(message="Tenant not found")
                tenant_id = tenants[0].tenant_id
        else:
            # 未配置ADMIN_EMAIL，使用用户自己的tenant
            tenants = UserTenantService.query(user_id=user.id)
            if not tenants:
                return get_data_error_result(message="Tenant not found")
            tenant_id = tenants[0].tenant_id

        # 获取或创建API Token
        tokens = APIToken.query(tenant_id=tenant_id)
        
        if tokens:
            return get_json_result(data={
                "token": tokens[0].beta or tokens[0].token,
                "beta": tokens[0].beta,
                "api_key": tokens[0].token
            })
        else:
            # 自动创建Token
            token = generate_confirmation_token(tenant_id)
            beta_token = "ragflow-" + get_uuid()[:32]

            token_obj = {
                "tenant_id": tenant_id,
                "token": token,
                "beta": beta_token,
                "dialog_id": None,
                "source": None,
                "create_time": current_timestamp(),
                "create_date": datetime_format(datetime.now()),
                "update_time": None,
                "update_date": None
            }

            if not APITokenService.save(**token_obj):
                return get_data_error_result(
                    message="Failed to create API token automatically"
                )

            return get_json_result(data={
                "token": beta_token,
                "beta": beta_token,
                "api_key": token
            })
    except Exception as e:
        return server_error_response(e)
```

### SU权限矩阵

| 用户类型 | ADMIN_EMAIL配置 | 访问权限 | 使用的tenant_id |
|---------|----------------|----------|----------------|
| SU本人 | ✅ 已配置 | ✅ 允许 | SU的tenant_id |
| SU团队成员 | ✅ 已配置 | ✅ 允许 | SU的tenant_id |
| 非团队用户 | ✅ 已配置 | ❌ 拒绝 | N/A |
| 普通用户 | ❌ 未配置 | ✅ 允许 | 用户自己的tenant_id |

---

## 数据流与时序图

### 获取设置流程

```sequence
Client->>API: GET /settings?user_id=xxx
API->>Auth: verify auth (api_key or session)
Auth-->>API: tenant_id, auth_method
API->>Team: verify_team_access(user_id, tenant_id)
Team-->>API: is_authorized=True
API->>Redis: get_sessions_from_redis(user_id)
Redis-->>API: cached_sessions or None
API->>MySQL: FreeChatUserSettings.get_by_user_id()
MySQL-->>API: setting object
API->>API: merge: cached_sessions > db_sessions
API-->>Client: {code: 0, data: settings}
```

### 保存设置流程（双写策略）

```sequence
Client->>API: POST /settings (sessions + other fields)
API->>Auth: verify auth
Auth-->>API: tenant_id
API->>Team: verify_team_access()
Team-->>API: authorized
API->>Redis: save_sessions_to_redis() [立即写入]
Redis-->>API: OK
API->>MySQL: FreeChatUserSettings.upsert() [异步持久化]
MySQL-->>API: success=True
API-->>Client: {code: 0, data: saved_settings}

Note: 如果MySQL失败
API->>Redis: invalidate_sessions_cache() [回滚]
API-->>Client: {code: 500, message: "Failed to save"}
```

---

## 总结

### 核心优势

✅ **双层缓存** - Redis + MySQL保证性能与持久化  
✅ **团队隔离** - 严格的租户权限验证  
✅ **灵活认证** - 支持API Key和Session两种方式  
✅ **容错机制** - Redis失败降级到MySQL

### 性能指标

| 操作 | 无缓存 | 有缓存 | 提升 |
|------|--------|--------|------|
| 获取设置 | ~50ms | ~2ms | **25x** |
| 保存设置 | ~80ms | ~10ms (Redis) + 异步MySQL | **8x** |

---

**相关文档**：
- [01_API认证系统.md](./01_API认证系统.md) - 认证装饰器详解
- [06_团队访问控制.md](./06_团队访问控制.md) - 权限验证详解
- [15_缓存策略.md](./15_缓存策略.md) - 完整缓存架构

**代码位置**: `api/apps/free_chat_app.py`  
**最后更新**: 2024年
