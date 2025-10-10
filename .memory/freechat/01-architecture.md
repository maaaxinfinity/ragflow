# FreeChat 架构设计详解

> 深入分析 FreeChat 的系统架构、数据流和设计决策

## 1. 整体架构

### 1.1 系统组件图

```
┌──────────────────────────────────────────────────────────────┐
│                         前端层 (Frontend)                      │
│  ┌────────────┐  ┌────────────┐  ┌───────────────────────┐  │
│  │ SessionList│  │ChatInterface│  │   ControlPanel       │  │
│  │  会话列表   │  │  对话界面   │  │   控制面板(Bot/KB)    │  │
│  └────────────┘  └────────────┘  └───────────────────────┘  │
│         │                │                     │              │
│  ┌──────┴────────────────┴─────────────────────┴──────────┐  │
│  │              Hooks 层 (State Management)              │  │
│  │  - use-free-chat.ts (核心对话逻辑)                     │  │
│  │  - use-free-chat-session.ts (会话管理)                │  │
│  │  - use-free-chat-settings-api.ts (设置同步)           │  │
│  │  - use-kb-toggle.ts (知识库管理)                       │  │
│  │  - use-dynamic-params.ts (参数管理)                   │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              ↓ HTTP / SSE
┌──────────────────────────────────────────────────────────────┐
│                         后端层 (Backend)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          API 层 (Flask Blueprints)                     │  │
│  │  - /api/free_chat/settings (GET/POST/DELETE)          │  │
│  │  - /api/free_chat/admin_token (GET)                   │  │
│  │  - /api/conversation/completion (POST/SSE)            │  │
│  └────────────────────────────────────────────────────────┘  │
│                              ↓                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          Service 层 (Business Logic)                   │  │
│  │  - FreeChatUserSettingsService (设置CRUD)              │  │
│  │  - DialogService (Dialog 管理)                         │  │
│  │  - ConversationService (对话管理)                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              ↓ SQL / Cache
┌──────────────────────────────────────────────────────────────┐
│                        数据层 (Data Layer)                     │
│  ┌──────────────────┐              ┌─────────────────────┐  │
│  │  MySQL 数据库     │              │   Redis 缓存        │  │
│  │  ┌──────────────┐ │              │  ┌────────────────┐│  │
│  │  │ free_chat_   │ │              │  │freechat:       ││  │
│  │  │ user_settings│ │              │  │sessions:*      ││  │
│  │  └──────────────┘ │              │  │(TTL: 7 days)   ││  │
│  │  ┌──────────────┐ │              │  └────────────────┘│  │
│  │  │conversation  │ │              │                     │  │
│  │  └──────────────┘ │              │                     │  │
│  │  ┌──────────────┐ │              │                     │  │
│  │  │dialog        │ │              │                     │  │
│  │  └──────────────┘ │              │                     │  │
│  └──────────────────┘              └─────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 数据流图

```
用户操作
  │
  ├─> 选择 Bot
  │   ↓
  │   前端更新 dialogId → 调用 updateField('dialog_id')
  │   ↓
  │   防抖 5 秒后自动保存 → PUT /api/free_chat/settings
  │   ↓
  │   后端保存到 Redis (L1) + MySQL (L2)
  │
  ├─> 选择知识库
  │   ↓
  │   前端更新 enabledKBs → KBContext 状态
  │   ↓
  │   下次发送消息时,kb_ids 作为参数传递
  │
  ├─> 调整参数
  │   ↓
  │   前端更新 model_params → 调用 updateField('model_params')
  │   ↓
  │   防抖 5 秒后自动保存 → PUT /api/free_chat/settings
  │
  └─> 发送消息
      ↓
      1. 添加用户消息到 derivedMessages
      ↓
      2. 如果没有 conversation_id,创建 Conversation
      ↓
      3. 构建请求体 {
           conversation_id,
           messages,
           kb_ids,          ← 动态知识库
           model_params,    ← 动态参数
           role_prompt      ← 角色提示词
         }
      ↓
      4. POST /api/conversation/completion (SSE)
      ↓
      5. 后端临时覆盖 Dialog 配置:
         dialog.kb_ids = req.kb_ids
      ↓
      6. 检索知识库 → 调用 LLM → 流式返回
      ↓
      7. 前端逐字显示回答
      ↓
      8. 更新 session.messages → 触发 updateSession
      ↓
      9. 防抖保存 → PUT /api/free_chat/settings
```

## 2. 核心设计决策

### 2.1 为什么使用 user_id 而不是 tenant_id?

**问题**: 如何标识外部用户?

**方案对比**:

| 方案 | 优点 | 缺点 |
|------|------|------|
| 使用 RAGFlow user_id | 集成简单 | 需要先创建 RAGFlow 用户 |
| 使用 tenant_id | 与现有系统一致 | 无法区分团队内的不同用户 |
| **使用外部 user_id** ✅ | 灵活,无需预创建用户 | 需要额外的团队验证逻辑 |

**选择**: 外部 user_id + 团队验证

**实现**:
```python
def verify_team_access(user_id: str, current_tenant_id: str):
    # 检查 user_id 的 Dialog 是否属于当前租户
    setting = FreeChatUserSettings.get(user_id=user_id)
    if setting and setting.dialog_id:
        dialog = Dialog.get(id=setting.dialog_id)
        if dialog.tenant_id != current_tenant_id:
            return False, "User does not belong to your team"
    return True, ""
```

### 2.2 为什么需要两级缓存?

**问题**: 会话数据频繁读写,如何优化性能?

**Redis L1 缓存**:
- **读取**: 每次加载页面
- **写入**: 每次保存设置 (防抖 5 秒)
- **优势**: 极快 (<1ms),减少 MySQL 负载

**MySQL L2 持久化**:
- **读取**: Redis 缓存未命中时
- **写入**: 与 Redis 同步写入
- **优势**: 保证数据不丢失

**缓存失效策略**:
- **TTL**: Redis 7 天自动过期
- **主动失效**: DELETE 操作时清除 Redis

```python
# 读取流程
def get_sessions_from_redis(user_id):
    data = REDIS_CONN.get(f"freechat:sessions:{user_id}")
    return json.loads(data) if data else None

def get_user_settings(user_id):
    # 尝试 L1 缓存
    cached = get_sessions_from_redis(user_id)
    if cached:
        return cached
    
    # L1 miss,读取 L2
    setting = FreeChatUserSettings.get(user_id=user_id)
    
    # 回填 L1
    save_sessions_to_redis(user_id, setting.sessions)
    return setting
```

### 2.3 为什么会话数据存储在设置表而不是独立表?

**问题**: 会话数据应该存储在哪里?

**方案对比**:

| 方案 | 优点 | 缺点 |
|------|------|------|
| 独立 sessions 表 | 规范化,易扩展 | 需要多次查询,复杂度高 |
| **存储在 settings 表** ✅ | 一次查询全部数据 | JSON 字段查询不便 |
| 前端 localStorage | 极快,无网络延迟 | 不跨设备,易丢失 |

**选择**: 存储在 settings 表的 JSON 字段

**理由**:
1. **简单**: 一次 API 调用获取全部数据
2. **性能**: Redis 缓存弥补 JSON 查询缺陷
3. **一致性**: 设置和会话绑定,原子性更新
4. **灵活**: 会话结构可以随时调整

```sql
CREATE TABLE free_chat_user_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  -- 其他设置字段...
  sessions JSON NOT NULL DEFAULT '[]'
  -- sessions 格式: [
  --   {
  --     id: "uuid",
  --     name: "Chat 1",
  --     messages: [...],
  --     conversation_id: "conv123",
  --     created_at: 1234567890
  --   }
  -- ]
);
```

### 2.4 为什么使用防抖而不是立即保存?

**问题**: 何时保存用户设置?

**方案对比**:

| 方案 | 优点 | 缺点 |
|------|------|------|
| 立即保存 | 数据实时同步 | 频繁 API 调用,性能差 |
| **防抖保存 (5秒)** ✅ | 减少 API 调用 | 可能丢失 5 秒内的数据 |
| 页面卸载时保存 | 最少 API 调用 | 浏览器崩溃会丢失数据 |

**选择**: 防抖保存 + 关键操作立即保存

**实现**:
```typescript
// 普通字段更新: 5 秒防抖
const debouncedSave = lodash.debounce(saveSettings, 5000);

// 会话数据: 5 秒防抖 + 静默模式 (不显示"未保存"提示)
updateField('sessions', sessions, { silent: true });

// 会话重命名: 立即保存 (用户主动操作)
const handleSessionRename = (sessionId, newName) => {
  updateSession(sessionId, { name: newName });
  setTimeout(() => manualSave(), 50); // 立即触发保存
};
```

**数据安全保障**:
1. 防抖保存兜底
2. 页面卸载前保存 (beforeunload 事件)
3. 定期心跳保存 (可选)
4. Redis 缓存保护

## 3. 前端架构

### 3.1 Hooks 分层架构

```
顶层 Hooks (业务逻辑)
  ├─ use-free-chat.ts
  │  ├─ 消息发送
  │  ├─ SSE 接收
  │  ├─ 消息历史管理
  │  └─ 调用底层 Hooks
  │
  ├─ use-free-chat-session.ts
  │  ├─ 会话 CRUD
  │  ├─ 会话切换
  │  └─ 数据同步到父组件
  │
  └─ use-free-chat-settings-api.ts
     ├─ 加载设置
     ├─ 保存设置 (防抖)
     └─ 与后端 API 交互

底层 Hooks (通用能力)
  ├─ useSendMessageWithSse (SSE 发送)
  ├─ useSelectDerivedMessages (消息管理)
  ├─ useHandleMessageInputChange (输入处理)
  └─ useKBContext (知识库上下文)
```

### 3.2 状态管理策略

**本地状态** (useState):
- `dialogId`: 当前选中的 Dialog
- `derivedMessages`: 当前会话的消息列表
- `sendLoading`: 发送状态

**Context 状态** (KBContext):
- `enabledKBs`: 选中的知识库 Set
- `toggleKB`: 切换知识库函数

**服务端状态** (React Query):
- `dialogData`: Dialog 列表 (缓存 5 分钟)
- `userInfo`: 用户信息 (缓存 10 分钟)
- `tenantInfo`: 租户信息 (缓存 10 分钟)

**持久化状态** (API 同步):
- `settings`: 用户设置 (实时同步到后端)
- `sessions`: 会话列表 (实时同步到后端)

### 3.3 消息同步机制

**核心问题**: 如何保证 `derivedMessages` 与 `session.messages` 同步?

**解决方案**: 使用 useEffect + Ref 避免循环依赖

```typescript
// BUG FIX #9 & #13: 使用 Ref 避免循环依赖
const currentSessionIdRef = useRef(currentSessionId);
const sessionsRef = useRef(sessions);
const isSyncingRef = useRef(false);

useEffect(() => {
  currentSessionIdRef.current = currentSessionId;
}, [currentSessionId]);

useEffect(() => {
  sessionsRef.current = sessions;
}, [sessions]);

// 同步 derivedMessages 到 session
useEffect(() => {
  const sessionId = currentSessionIdRef.current;
  if (sessionId && derivedMessages.length > 0 && !isSyncingRef.current) {
    const session = sessionsRef.current.find(s => s.id === sessionId);
    if (!session) return;

    // 检查是否变化
    const messagesChanged = /* ... */;
    
    if (messagesChanged) {
      isSyncingRef.current = true;
      updateSession(sessionId, { messages: derivedMessages });
      Promise.resolve().then(() => {
        isSyncingRef.current = false;
      });
    }
  }
}, [derivedMessages, updateSession]); // 不依赖 sessions!
```

**关键点**:
1. 使用 Ref 存储最新的 `sessions` 和 `currentSessionId`
2. 避免将 `sessions` 放入依赖数组 (避免循环)
3. 使用 `isSyncingRef` 标记防止重入
4. 使用 `Promise.resolve()` 确保微任务调度

## 4. 后端架构

### 4.1 API 设计

**RESTful 设计**:

```
GET  /api/free_chat/settings?user_id=xxx
  - 获取用户设置
  - 返回: { user_id, dialog_id, model_params, kb_ids, role_prompt, sessions }

POST /api/free_chat/settings
  - 创建/更新用户设置
  - 请求体: { user_id, ...settings }
  - 返回: 更新后的设置

DELETE /api/free_chat/settings/<user_id>
  - 删除用户设置
  - 返回: { success: true }

GET /api/free_chat/admin_token
  - 获取管理员 API Token
  - 返回: { token, beta, api_key }
```

**SSE 设计** (对话流式返回):

```
POST /api/conversation/completion
  - Content-Type: text/event-stream
  - 请求体: { conversation_id, messages, kb_ids, ... }
  - 响应流: 
    data: {"answer": "Hello", "reference": [...]}
    data: {"answer": " world", "reference": [...]}
    data: {"answer": "!", "reference": [...]}
```

### 4.2 权限验证流程

```python
def verify_team_access(user_id, current_tenant_id):
    """
    验证 user_id 是否可被当前租户访问
    
    逻辑:
    1. 获取 user_id 的设置
    2. 如果设置不存在,允许 (首次访问)
    3. 如果设置存在:
       a. 获取设置中的 dialog_id
       b. 查询 Dialog 是否存在
       c. 验证 Dialog 的 tenant_id 是否匹配
    4. 如果验证失败,返回错误
    """
    exists, setting = FreeChatUserSettingsService.get_by_user_id(user_id)
    
    if exists and setting.dialog_id:
        # 验证 Dialog 归属
        dialogs = DialogService.query(
            id=setting.dialog_id, 
            tenant_id=current_tenant_id
        )
        if not dialogs:
            return False, "User does not belong to your team"
    
    return True, ""
```

### 4.3 ADMIN_EMAIL 机制

**目的**: 控制谁可以访问 FreeChat

**逻辑**:
```python
admin_email = os.environ.get("ADMIN_EMAIL")  # 例: admin@company.com

if admin_email:
    su_user = UserService.query(email=admin_email)[0]
    su_tenant_id = su_user.id  # SU 的 tenant_id = SU 的 user_id
    
    if user.id == su_user.id:
        # 当前用户就是 SU,使用 SU 的 tenant_id
        tenant_id = su_tenant_id
    else:
        # 检查当前用户是否在 SU 的团队中
        su_team_members = UserTenantService.get_by_tenant_id(su_tenant_id)
        if user.id in [m['user_id'] for m in su_team_members]:
            # 团队成员,使用 SU 的 tenant_id
            tenant_id = su_tenant_id
        else:
            # 不在团队中,拒绝访问
            return error("Access denied")
else:
    # 未配置 ADMIN_EMAIL,使用用户自己的 tenant_id
    tenant_id = user's own tenant_id
```

**配置示例**:
```bash
# docker/.env
ADMIN_EMAIL=admin@mycompany.com
```

## 5. 数据模型

### 5.1 FreeChatUserSettings 表

```python
class FreeChatUserSettings(DataBaseModel):
    user_id = CharField(max_length=255, primary_key=True)
    dialog_id = CharField(max_length=32, default="")
    model_params = JSONField(default={"temperature": 0.7, "top_p": 0.9})
    kb_ids = ListField(default=[])
    role_prompt = LongTextField(default="")
    sessions = JSONField(default=[])
    
    class Meta:
        db_table = "free_chat_user_settings"
```

**字段说明**:
- `user_id`: 外部用户 ID (主键,任意字符串)
- `dialog_id`: 选中的 Dialog ID (关联到 dialog 表)
- `model_params`: 模型参数 JSON `{temperature, top_p, frequency_penalty, presence_penalty, max_tokens}`
- `kb_ids`: 知识库 ID 列表 `["kb1", "kb2"]`
- `role_prompt`: 自定义角色提示词
- `sessions`: 会话数据 JSON `[{id, name, messages, conversation_id, created_at}, ...]`

### 5.2 Session 数据结构

```typescript
interface Session {
  id: string;                    // UUID
  name: string;                  // 会话名称 (可重命名)
  messages: Message[];           // 消息列表
  conversation_id?: string;      // 关联的 Conversation ID
  created_at: number;            // 创建时间戳
}

interface Message {
  id: string;                    // UUID
  role: 'user' | 'assistant';    // 角色
  content: string;               // 消息内容
  reference?: any[];             // 引用文档 (AI 消息)
}
```

**示例数据**:
```json
{
  "user_id": "user123",
  "dialog_id": "abc123",
  "model_params": {
    "temperature": 0.8,
    "top_p": 0.95
  },
  "kb_ids": ["kb1", "kb2"],
  "role_prompt": "你是一个友好的助手",
  "sessions": [
    {
      "id": "session-uuid-1",
      "name": "关于产品的讨论",
      "messages": [
        {
          "id": "msg-uuid-1",
          "role": "user",
          "content": "你好"
        },
        {
          "id": "msg-uuid-2",
          "role": "assistant",
          "content": "你好!有什么可以帮你的吗?",
          "reference": []
        }
      ],
      "conversation_id": "conv123",
      "created_at": 1704902400000
    }
  ]
}
```

## 6. 性能优化

### 6.1 防抖优化

**场景**: 用户频繁切换知识库或调整参数

**问题**: 每次操作都立即保存,导致频繁 API 调用

**解决**: Lodash debounce 5 秒

```typescript
const debouncedSave = useMemo(
  () => lodash.debounce(saveSettings, 5000),
  [saveSettings]
);

useEffect(() => {
  if (hasUnsavedChanges) {
    debouncedSave();
  }
}, [hasUnsavedChanges, debouncedSave]);
```

**效果**: 5 秒内多次修改只调用 1 次 API

### 6.2 Redis 缓存优化

**读取优化**:
```python
def get_user_settings(user_id):
    # L1: Redis (< 1ms)
    cached = get_sessions_from_redis(user_id)
    if cached:
        return cached
    
    # L2: MySQL (~10ms)
    setting = FreeChatUserSettings.get(user_id=user_id)
    
    # 回填 L1
    save_sessions_to_redis(user_id, setting.sessions)
    return setting
```

**写入优化**:
```python
def save_user_settings(user_id, sessions):
    # Step 1: 快速写入 Redis (< 1ms)
    save_sessions_to_redis(user_id, sessions)
    
    # Step 2: 异步持久化到 MySQL (~50ms)
    FreeChatUserSettingsService.upsert(user_id, sessions=sessions)
```

### 6.3 React Query 缓存优化

**Dialog 列表缓存**:
```typescript
useQuery({
  queryKey: ['dialogList'],
  queryFn: fetchDialogList,
  staleTime: 5 * 60 * 1000,   // 5 分钟内不重新请求
  cacheTime: 10 * 60 * 1000,  // 10 分钟内保留缓存
});
```

**效果**: 切换页面时无需重新加载 Dialog 列表

## 7. 错误处理

### 7.1 前端错误处理

```typescript
// utils/error-handler.ts
export const logError = (
  error: string,
  context: string,
  showToast: boolean = true,
  userMessage?: string
) => {
  console.error(`[FreeChat Error] ${context}:`, error);
  
  if (showToast) {
    toast.error(userMessage || error);
  }
};
```

**使用场景**:
- API 调用失败
- 消息发送失败
- 会话加载失败
- Dialog 不存在

### 7.2 后端错误处理

```python
try:
    # 业务逻辑
except Exception as e:
    logging.error(f"[FreeChat] Error: {e}")
    return server_error_response(e)
```

**统一错误响应**:
```json
{
  "code": 500,
  "message": "Internal server error",
  "data": null
}
```

## 8. 安全性

### 8.1 团队隔离

- 每个 user_id 只能访问同一团队的数据
- 通过 Dialog 的 tenant_id 验证归属
- API 调用时验证权限

### 8.2 XSS 防护

- 所有用户输入经过 sanitize
- React 自动转义 HTML
- Markdown 渲染使用 `rehype-raw` + DOMPurify

### 8.3 CSRF 防护

- 使用 Flask-Login session 认证
- API Key 认证无需 CSRF token
- SameSite Cookie 策略

---

**下一文档**: [后端 API 实现](02-backend-api.md) - 详细的 API 实现分析
