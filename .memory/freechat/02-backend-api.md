# FreeChat 后端 API 实现详解

> 最后更新: 2025-01-10 - 添加新的 Session/Message API

## 1. API 端点概览

### 1.1 Settings API（旧架构，保留用于兼容）

| 端点 | 方法 | 认证 | 功能 |
|------|------|------|------|
| `/api/v1/free_chat/settings` | GET | API Key / Session | 获取用户设置 |
| `/api/v1/free_chat/settings` | POST/PUT | API Key / Session | 保存/更新设置 |
| `/api/v1/free_chat/settings/<user_id>` | DELETE | Session | 删除用户设置 |
| `/api/v1/free_chat/admin_token` | GET | Session / Access Token | 获取 API Token |

### 1.2 Session/Message API（新架构，推荐使用）

| 端点 | 方法 | 认证 | 功能 |
|------|------|------|------|
| `/api/v1/free_chat_session/sessions` | GET | API Key / Session | 获取会话列表 |
| `/api/v1/free_chat_session/sessions` | POST | API Key / Session | 创建会话 |
| `/api/v1/free_chat_session/sessions/<id>` | PUT | API Key / Session | 更新会话 |
| `/api/v1/free_chat_session/sessions/<id>` | DELETE | API Key / Session | 删除会话 |
| `/api/v1/free_chat_session/sessions/<id>/messages` | GET | API Key / Session | 获取消息（支持分页） |
| `/api/v1/free_chat_session/sessions/<id>/messages` | POST | API Key / Session | 创建消息 |
| `/api/v1/free_chat_session/messages/<id>` | PUT | API Key / Session | 更新消息 |
| `/api/v1/free_chat_session/messages/<id>` | DELETE | API Key / Session | 删除消息 |

### 1.3 对话 API

| 端点 | 方法 | 认证 | 功能 |
|------|------|------|------|
| `/api/v1/conversation/completion` | POST | Session | 对话补全 (SSE) |

### 1.2 文件结构

```
api/apps/free_chat_app.py          # FreeChat API 端点
api/db/services/
  └── free_chat_user_settings_service.py  # 设置服务层
api/db/db_models.py                 # FreeChatUserSettings 模型
api/apps/conversation_app.py        # 对话 API (支持动态参数)
```

## 2. 设置管理 API

### 2.1 GET /api/free_chat/settings

**功能**: 获取用户的 FreeChat 设置

**请求参数**:
```
GET /api/free_chat/settings?user_id=user123
Authorization: Bearer <api_key>  或 Session Cookie
```

**流程图**:
```
用户请求
  ↓
验证认证 (API Key / Session)
  ↓
获取 tenant_id
  ├─ API Key 认证: 从 decorator 获取
  └─ Session 认证: 从 current_user 获取
  ↓
验证团队访问权限 verify_team_access(user_id, tenant_id)
  ├─ 检查 user_id 的 dialog 是否属于当前租户
  ├─ 如果不属于 → 返回 403 Forbidden
  └─ 如果属于或首次访问 → 继续
  ↓
尝试从 Redis 读取会话数据 (L1 缓存)
  ├─ 命中缓存 → 直接返回
  └─ 未命中 → 从 MySQL 读取
        ↓
     回填 Redis 缓存 (TTL 7 天)
        ↓
     返回设置数据
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "user_id": "user123",
    "dialog_id": "abc123",
    "model_params": {
      "temperature": 0.7,
      "top_p": 0.9
    },
    "kb_ids": ["kb1", "kb2"],
    "role_prompt": "",
    "sessions": [
      {
        "id": "session-uuid",
        "name": "Chat 1",
        "messages": [],
        "created_at": 1704902400000
      }
    ]
  }
}
```

**核心代码**:
```python
@manager.route("/settings", methods=["GET"])
@api_key_or_login_required
def get_user_settings(**kwargs):
    user_id = request.args.get("user_id")
    
    # 获取 tenant_id (根据认证方式)
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        current_tenant_id = kwargs.get("tenant_id")
    else:
        tenants = UserTenantService.query(user_id=current_user.id)
        current_tenant_id = tenants[0].tenant_id
    
    # 验证团队访问权限
    is_authorized, error_msg = verify_team_access(user_id, current_tenant_id)
    if not is_authorized:
        return get_data_error_result(message=error_msg, code=403)
    
    # 尝试从 Redis 读取 (L1)
    cached_sessions = get_sessions_from_redis(user_id)
    
    # 查询设置
    exists, setting = FreeChatUserSettingsService.get_by_user_id(user_id)
    if exists:
        result = setting.to_dict()
        # 使用 Redis 缓存的会话数据 (如果有)
        if cached_sessions is not None:
            result['sessions'] = cached_sessions
        else:
            # 缓存未命中,回填 Redis
            save_sessions_to_redis(user_id, result['sessions'])
        return get_json_result(data=result)
    else:
        # 返回默认设置
        return get_json_result(data={
            "user_id": user_id,
            "dialog_id": "",
            "model_params": {"temperature": 0.7, "top_p": 0.9},
            "kb_ids": [],
            "role_prompt": "",
            "sessions": []
        })
```

### 2.2 POST/PUT /api/free_chat/settings

**功能**: 保存/更新用户设置

**请求体**:
```json
{
  "user_id": "user123",
  "dialog_id": "abc123",
  "model_params": {
    "temperature": 0.8,
    "top_p": 0.95
  },
  "kb_ids": ["kb1"],
  "role_prompt": "你是一个友好的助手",
  "sessions": [...]
}
```

**流程**:
```
验证认证和团队权限 (同 GET)
  ↓
验证 dialog_id 属于当前租户 (如果提供)
  ↓
Step 1: 立即保存到 Redis (快速响应)
  - 保存会话数据到 Redis
  - TTL 7 天
  ↓
Step 2: 持久化到 MySQL (保证不丢失)
  - upsert (insert or update)
  - 成功 → 返回 200
  - 失败 → 删除 Redis 缓存,返回 500
```

**核心代码**:
```python
@manager.route("/settings", methods=["POST", "PUT"])
@api_key_or_login_required
@validate_request("user_id")
def save_user_settings(**kwargs):
    req = request.json
    user_id = req.get("user_id")
    
    # 验证权限 (省略...)
    
    data = {
        "dialog_id": req.get("dialog_id", ""),
        "model_params": req.get("model_params", {}),
        "kb_ids": req.get("kb_ids", []),
        "role_prompt": req.get("role_prompt", ""),
        "sessions": req.get("sessions", [])
    }
    
    # Step 1: 立即保存到 Redis
    save_sessions_to_redis(user_id, data['sessions'])
    
    # Step 2: 持久化到 MySQL
    success, result = FreeChatUserSettingsService.upsert(user_id, **data)
    if success:
        return get_json_result(data=result.to_dict())
    else:
        # MySQL 失败,删除 Redis 缓存避免不一致
        invalidate_sessions_cache(user_id)
        return get_data_error_result(message=f"Failed: {result}")
```

### 2.3 DELETE /api/free_chat/settings/<user_id>

**功能**: 删除用户设置

**请求**:
```
DELETE /api/free_chat/settings/user123
Cookie: session=...
```

**流程**:
```
验证 Session 认证
  ↓
验证团队权限
  ↓
从 MySQL 删除记录
  ↓
删除 Redis 缓存
  ↓
返回成功
```

**核心代码**:
```python
@manager.route("/settings/<user_id>", methods=["DELETE"])
@login_required
def delete_user_settings(user_id):
    # 验证权限 (省略...)
    
    # 删除 MySQL 记录
    success = FreeChatUserSettingsService.delete_by_user_id(user_id)
    if success:
        # 同时删除 Redis 缓存
        invalidate_sessions_cache(user_id)
        return get_json_result(data=True)
    else:
        return get_data_error_result(message="Failed to delete")
```

## 3. Token 管理 API

### 3.1 GET /api/free_chat/admin_token

**功能**: 获取管理员 API Token (用于 iframe 嵌入)

**请求**:
```
GET /api/free_chat/admin_token
Authorization: Bearer <access_token>  或 Session Cookie
```

**逻辑**:
```
验证认证 (多种方式)
  ├─ Authorization header (Bearer token)
  ├─ Session Cookie (Flask-Login)
  └─ 如果都不存在 → 401 Unauthorized
  ↓
判断当前用户的租户
  ├─ 如果 ADMIN_EMAIL 已配置:
  │   ├─ 获取 SU (super user)
  │   ├─ 检查当前用户是否是 SU 或 SU 团队成员
  │   ├─ 是 → 使用 SU 的 tenant_id
  │   └─ 否 → 403 Access Denied
  └─ 如果未配置: 使用用户自己的 tenant_id
  ↓
查询 API Token
  ├─ 找到 → 返回 beta token (iframe 用)
  └─ 未找到 → 自动创建 token
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "token": "ragflow-abc123...",  // Beta Token (iframe 用)
    "beta": "ragflow-abc123...",
    "api_key": "real-api-key"      // 真实 API Key
  }
}
```

**核心代码**:
```python
@manager.route("/admin_token", methods=["GET"])
def get_admin_token():
    # 多种认证方式
    user = None
    
    # 方式 1: Bearer Token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        access_token = auth_header.split()[1]
        users = UserService.query(access_token=access_token)
        if users:
            user = users[0]
    
    # 方式 2: Session
    if not user and current_user.is_authenticated:
        user = current_user
    
    if not user:
        return get_data_error_result(message="Authentication required", code=401)
    
    # 确定 tenant_id
    admin_email = os.environ.get("ADMIN_EMAIL")
    if admin_email:
        su_users = UserService.query(email=admin_email)
        if su_users:
            su_user = su_users[0]
            su_tenant_id = su_user.id
            
            if user.id == su_user.id:
                # 当前用户是 SU
                tenant_id = su_tenant_id
            else:
                # 检查是否在 SU 团队
                su_members = UserTenantService.get_by_tenant_id(su_tenant_id)
                if user.id in [m['user_id'] for m in su_members]:
                    tenant_id = su_tenant_id
                else:
                    return get_data_error_result(
                        message="Access denied. Only team members can access.",
                        code=403
                    )
    else:
        # 未配置 ADMIN_EMAIL,使用用户自己的租户
        tenants = UserTenantService.query(user_id=user.id)
        tenant_id = tenants[0].tenant_id
    
    # 查询或创建 API Token
    tokens = APIToken.query(tenant_id=tenant_id)
    if tokens:
        return get_json_result(data={
            "token": tokens[0].beta or tokens[0].token,
            "beta": tokens[0].beta,
            "api_key": tokens[0].token
        })
    else:
        # 自动创建 Token
        token = generate_confirmation_token(tenant_id)
        beta_token = "ragflow-" + get_uuid()[:32]
        
        APITokenService.save(
            tenant_id=tenant_id,
            token=token,
            beta=beta_token,
            create_time=current_timestamp()
        )
        
        return get_json_result(data={
            "token": beta_token,
            "beta": beta_token,
            "api_key": token
        })
```

## 4. 对话 API (动态参数)

### 4.1 POST /api/conversation/completion

**修改点**: 支持动态 `kb_ids` 参数

**原始流程**:
```python
def completion(dialog_id, conversation_id, messages):
    dialog = DialogService.get(id=dialog_id)
    kb_ids = dialog.kb_ids  # 使用 Dialog 固定配置
    # ... 检索和生成
```

**FreeChat 修改后**:
```python
def completion(dialog_id, conversation_id, messages, **kwargs):
    dialog = DialogService.get(id=dialog_id)
    
    # 动态覆盖 kb_ids (Line 183-185)
    kb_ids = request.json.get("kb_ids", [])
    if kb_ids:
        dialog.kb_ids = kb_ids  # 临时覆盖,不保存到数据库
    
    # ... 检索和生成 (使用覆盖后的 kb_ids)
```

**关键代码片段** (api/apps/conversation_app.py):
```python
@manager.route('/completion', methods=['POST'])
@login_required
def completion():
    req = request.json
    
    # Line 183-185: 提取动态知识库参数
    kb_ids = req.get("kb_ids", [])
    req.pop("kb_ids", None)  # 移除,避免传递到下游
    
    # 获取 Dialog
    dialog = DialogService.query(id=req['conversation_id'])[0]
    
    # Line 223-225: 临时覆盖 kb_ids
    if kb_ids:
        dialog.kb_ids = kb_ids
    
    # 继续检索和生成流程...
```

## 5. 服务层实现

### 5.1 FreeChatUserSettingsService

**文件**: `api/db/services/free_chat_user_settings_service.py`

```python
class FreeChatUserSettingsService(CommonService):
    model = FreeChatUserSettings
    
    @classmethod
    def get_by_user_id(cls, user_id):
        """根据 user_id 查询设置"""
        try:
            setting = cls.model.get(cls.model.user_id == user_id)
            return True, setting
        except Exception:
            return False, None
    
    @classmethod
    def upsert(cls, user_id, **kwargs):
        """插入或更新设置"""
        try:
            exists, setting = cls.get_by_user_id(user_id)
            if exists:
                # 更新
                update_query = cls.model.update(**kwargs).where(
                    cls.model.user_id == user_id
                )
                update_query.execute()
                return True, cls.model.get(cls.model.user_id == user_id)
            else:
                # 插入
                kwargs['user_id'] = user_id
                cls.save(**kwargs)
                return True, cls.model.get(cls.model.user_id == user_id)
        except Exception as e:
            return False, str(e)
    
    @classmethod
    def delete_by_user_id(cls, user_id):
        """删除设置"""
        try:
            num = cls.model.delete().where(
                cls.model.user_id == user_id
            ).execute()
            return num > 0
        except Exception:
            return False
```

## 6. Redis 缓存实现

### 6.1 缓存操作

```python
REDIS_SESSION_KEY_PREFIX = "freechat:sessions:"
REDIS_SESSION_TTL = 7 * 24 * 60 * 60  # 7 days

def get_sessions_from_redis(user_id: str):
    """从 Redis 读取会话 (L1 缓存)"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        data = REDIS_CONN.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logging.warning(f"Redis get failed: {e}")
    return None

def save_sessions_to_redis(user_id: str, sessions: list):
    """保存会话到 Redis (TTL 7 天)"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        REDIS_CONN.set_obj(key, sessions, REDIS_SESSION_TTL)
        logging.info(f"Cached sessions to Redis for user {user_id}")
    except Exception as e:
        logging.error(f"Redis save failed: {e}")

def invalidate_sessions_cache(user_id: str):
    """删除 Redis 缓存"""
    try:
        key = f"{REDIS_SESSION_KEY_PREFIX}{user_id}"
        REDIS_CONN.delete(key)
        logging.info(f"Invalidated cache for user {user_id}")
    except Exception as e:
        logging.error(f"Redis delete failed: {e}")
```

### 6.2 缓存策略

**读取**:
1. 尝试从 Redis 读取 (快速路径)
2. 如果 Redis 未命中,从 MySQL 读取
3. 回填 Redis 缓存

**写入**:
1. 立即写入 Redis (快速响应)
2. 同步写入 MySQL (保证持久化)
3. 如果 MySQL 失败,删除 Redis 避免不一致

**失效**:
1. 自动失效: TTL 7 天
2. 主动失效: DELETE 操作时清除

## 7. 权限验证详解

### 7.1 verify_team_access 函数

```python
def verify_team_access(user_id: str, current_tenant_id: str) -> tuple[bool, str]:
    """
    验证 user_id 是否可被当前租户访问
    
    逻辑:
    1. 如果 user_id 的设置不存在 → 允许 (首次访问)
    2. 如果设置存在且有 dialog_id:
       a. 查询 Dialog 是否存在
       b. 验证 Dialog 的 tenant_id 是否匹配
       c. 不匹配 → 拒绝 (跨团队访问)
    3. 匹配 → 允许
    
    Returns:
        (is_authorized, error_message)
    """
    try:
        exists, setting = FreeChatUserSettingsService.get_by_user_id(user_id)
        
        if exists and setting.dialog_id and setting.dialog_id.strip():
            # 验证 Dialog 归属
            dialogs = DialogService.query(
                id=setting.dialog_id, 
                tenant_id=current_tenant_id
            )
            if not dialogs:  # dialogs is a list
                return False, "User does not belong to your team"
        
        # 首次访问或 Dialog 属于当前租户
        return True, ""
    
    except Exception as e:
        return False, f"Authorization check failed: {str(e)}"
```

### 7.2 多种认证方式支持

```python
@api_key_or_login_required
def my_endpoint(**kwargs):
    auth_method = kwargs.get("auth_method")
    
    if auth_method == "api_key":
        # API Key 认证
        tenant_id = kwargs.get("tenant_id")  # 从 decorator 提供
        api_token = kwargs.get("api_token")
    else:
        # Session 认证
        tenant_id = current_user.tenant_id
        user_id = current_user.id
```

## 8. 错误处理

### 8.1 统一错误响应

```python
def get_data_error_result(message, code=400):
    return jsonify({
        "code": code,
        "message": message,
        "data": None
    }), 200  # HTTP 状态码总是 200,业务状态在 code 字段

def server_error_response(e):
    logging.exception(e)
    return jsonify({
        "code": 500,
        "message": "Internal server error",
        "data": None
    }), 500
```

### 8.2 常见错误码

| Code | 含义 | 示例 |
|------|------|------|
| 0 | 成功 | 正常返回 |
| 400 | 请求参数错误 | 缺少 user_id |
| 401 | 未认证 | Token 无效 |
| 403 | 权限不足 | 跨团队访问 |
| 404 | 资源不存在 | Dialog 不存在 |
| 500 | 服务器错误 | 数据库异常 |

---

**下一文档**: [前端实现细节](03-frontend-implementation.md)
