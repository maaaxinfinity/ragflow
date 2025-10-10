# Session 存储架构设计

## 核心原则

### 1. Draft Sessions（草稿会话）
- **存储位置**：仅存储在前端（Zustand + localStorage）
- **用途**：作为用户选择助手卡后的临时起点，用于创建正式对话
- **不保存到后端的原因**：
  - 草稿是临时状态，没有持久化价值
  - 避免后端存储大量未使用的草稿
  - 减少 API 调用和数据传输

### 2. Active Sessions（活跃会话）
- **存储位置**：前端 + 后端
- **前端存储**：完整会话信息（Zustand + localStorage）
- **后端存储**：仅元数据（不包含 messages）

## 后端存储结构

### Settings API 中的 Sessions 字段

```typescript
// ✅ 正确的存储结构
{
  "user_id": "xxx",
  "dialog_id": "xxx",
  "sessions": [
    {
      "id": "conversation_id",           // 会话ID
      "conversation_id": "conversation_id", // 对话ID
      "model_card_id": 2,                // 助手卡ID
      "name": "对话名称",                // 会话名称
      "created_at": 1759996379802,       // 创建时间
      "updated_at": 1759996379802,       // 更新时间
      "state": "active",                 // 会话状态
      "is_favorited": false,             // 是否收藏
      "params": {                        // 参数配置
        "temperature": 0.3,
        "top_p": 1.0
      }
      // ❌ messages 字段不应该在这里
    }
  ]
}
```

### Messages 的获取方式

Messages 应该从对话接口获取，而不是存储在 settings 中：

```typescript
// 当需要加载某个会话的消息时
GET /v1/conversation/get?conversation_id={conversation_id}

// 返回完整的消息列表
{
  "code": 0,
  "data": {
    "id": "conversation_id",
    "name": "对话名称",
    "message": [
      {
        "role": "user",
        "content": "你好"
      },
      {
        "role": "assistant",
        "content": "您好！..."
      }
    ]
  }
}
```

## 实现细节

### 前端过滤逻辑

在 `use-free-chat-settings-api.ts` 的 `saveToAPI` 方法中：

```typescript
// Filter out draft sessions and strip messages from active sessions
const activeSessions = (settings.sessions || [])
  .filter(session => session.state === 'active') // ✅ 只保存 active sessions
  .map(session => ({
    id: session.id,
    conversation_id: session.conversation_id,
    model_card_id: session.model_card_id,
    name: session.name,
    created_at: session.created_at,
    updated_at: session.updated_at,
    state: session.state,
    is_favorited: session.is_favorited,
    params: session.params,
    // ✅ messages 被有意排除，应该从 /v1/conversation/get 获取
  }));
```

### 为什么这样设计？

#### 1. 性能优化
- **减少数据传输**：Settings API 不需要传输大量的消息内容
- **快速加载**：用户切换会话时，只需要加载元数据，消息可以按需加载

#### 2. 数据一致性
- **单一数据源**：Messages 的权威来源是对话表（SQL），而不是 settings
- **避免冗余**：同一份消息数据不应该存储在多个地方

#### 3. 存储成本
- **减少后端存储**：Settings 表只存储少量元数据
- **减少前端缓存**：localStorage 不需要缓存所有历史消息

## 数据流

### 创建新对话

```
用户点击助手卡
    ↓
前端创建 Draft Session（仅前端）
    ↓
用户发送第一条消息
    ↓
调用 /v1/conversation/set 创建对话
    ↓
Draft → Active（前端状态转换）
    ↓
Active Session 元数据保存到 Settings API
    ↓
Messages 存储在对话表（SQL）
```

### 加载历史对话

```
用户打开 FreeChat 页面
    ↓
加载 Settings API → 获取 Active Sessions 列表
    ↓
用户点击某个会话
    ↓
调用 /v1/conversation/get → 获取该会话的完整消息
    ↓
消息显示在聊天界面
```

### 删除对话

```
用户点击删除按钮
    ↓
调用 /v1/conversation/rm → 删除对话表中的记录
    ↓
从前端 Sessions 列表中移除
    ↓
调用 Settings API 更新 Sessions 列表
```

## 优势总结

| 特性 | 旧架构（存储 messages） | 新架构（仅元数据） |
|------|------------------------|------------------|
| **API 响应大小** | 几十 KB 到几 MB | < 10 KB |
| **加载速度** | 慢 | 快 |
| **存储成本** | 高 | 低 |
| **数据一致性** | 可能不一致 | 单一数据源 |
| **Draft 污染** | 大量无用数据 | 无 |

## 注意事项

### 1. 后端兼容性

如果后端当前返回了 messages 字段，前端应该：
- ✅ 接受并使用这些数据（向后兼容）
- ✅ 但在保存时不传递 messages（向前兼容）

### 2. 迁移策略

对于已有的包含 messages 的 settings 数据：
- ✅ 前端可以正常读取
- ✅ 下次保存时自动清理 messages
- ✅ 逐步迁移到新架构

### 3. Draft Session 的持久化

Draft Sessions 虽然不保存到后端，但会保存到 localStorage：
- ✅ 用户刷新页面后仍然存在
- ✅ 用户关闭浏览器后会清空（根据 localStorage 策略）
- ✅ 用户可以继续在草稿基础上创建对话

## API 接口

### 1. Settings API

#### GET /v1/free_chat/settings
获取用户的 FreeChat 设置，包含会话列表（仅元数据）

**请求参数**:
```
?user_id={user_id}
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "user_id": "xxx",
    "dialog_id": "xxx",
    "model_params": {...},
    "kb_ids": [...],
    "sessions": [
      {
        "id": "conversation_id",
        "conversation_id": "conversation_id",
        "model_card_id": 2,
        "name": "对话名称",
        "created_at": 1759996379802,
        "updated_at": 1759996379802,
        "state": "active",
        "is_favorited": false,
        "params": {...}
        // ✅ 不包含 messages
      }
    ]
  }
}
```

#### POST /v1/free_chat/settings
保存用户设置

**请求 Body**:
```json
{
  "user_id": "xxx",
  "dialog_id": "xxx",
  "sessions": [
    {
      "id": "xxx",
      "state": "active",  // ✅ 只有 active 会被保存
      "messages": [...]   // ✅ 会被后端过滤掉
    },
    {
      "id": "yyy",
      "state": "draft"    // ❌ Draft 会被后端过滤掉
    }
  ]
}
```

**后端处理**:
- 过滤掉 `state !== "active"` 的 sessions
- 移除所有 session 的 `messages` 字段
- 只保存元数据

### 2. Conversation API

#### GET /v1/conversation/get
获取某个对话的完整消息列表

**请求参数**:
```
?conversation_id={conversation_id}
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "id": "conversation_id",
    "name": "对话名称",
    "message": [
      {
        "role": "user",
        "content": "你好",
        "id": "msg_1"
      },
      {
        "role": "assistant",
        "content": "您好！...",
        "id": "msg_2"
      }
    ],
    "reference": [...],
    "avatar": "..."
  }
}
```

## 前端实现

### 切换会话时加载消息

```typescript
// 当用户点击切换会话
const handleSwitchSession = async (sessionId: string) => {
  // 1. 切换到该会话（更新 currentSessionId）
  switchSession(sessionId);
  
  // 2. 获取该会话的完整信息
  const session = sessions.find(s => s.id === sessionId);
  
  // 3. 如果是 active 会话且有 conversation_id，从 API 加载消息
  if (session?.state === 'active' && session.conversation_id) {
    const response = await fetch(
      `/v1/conversation/get?conversation_id=${session.conversation_id}`
    );
    const data = await response.json();
    
    if (data.code === 0) {
      // 4. 更新 session 的 messages
      updateSession(sessionId, {
        messages: data.data.message
      });
    }
  }
  
  // 5. 如果是 draft，messages 为空
};
```

### 优化：消息懒加载

```typescript
// 只在真正需要显示消息时才加载
const useLazyLoadMessages = (sessionId: string) => {
  const [loading, setLoading] = useState(false);
  const session = useSessionStore(state => 
    state.sessions.find(s => s.id === sessionId)
  );
  
  useEffect(() => {
    // 如果 session 是 active 但还没有加载过消息
    if (
      session?.state === 'active' && 
      session.conversation_id &&
      (!session.messages || session.messages.length === 0)
    ) {
      loadMessages();
    }
  }, [session]);
  
  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/v1/conversation/get?conversation_id=${session.conversation_id}`
      );
      const data = await response.json();
      
      if (data.code === 0) {
        updateSession(sessionId, {
          messages: data.data.message
        });
      }
    } finally {
      setLoading(false);
    }
  };
  
  return { loading, loadMessages };
};
```

## 相关文件

### 前端
- `web/src/pages/free-chat/hooks/use-free-chat-settings-api.ts` - Settings API 交互（已修改：过滤 draft 和 messages）
- `web/src/pages/free-chat/store/session.ts` - Zustand Session Store
- `web/src/pages/free-chat/hooks/use-free-chat-with-machine.ts` - 会话管理主逻辑

### 后端
- `api/apps/free_chat_app.py` - Settings API（已修改：过滤 draft 和 messages）
- `api/apps/conversation_app.py` - Conversation API（已有 `/v1/conversation/get`）

## 测试验证

### 1. 验证 Draft 不被保存

```bash
# 前端发送包含 draft 的请求
POST /v1/free_chat/settings
{
  "sessions": [
    {"id": "1", "state": "draft"},
    {"id": "2", "state": "active"}
  ]
}

# 后端日志应该显示
[FreeChat] Raw sessions count: 2, Active sessions count: 1

# 数据库中应该只有 1 个 session
```

### 2. 验证 Messages 不被保存

```bash
# 前端发送包含 messages 的请求
POST /v1/free_chat/settings
{
  "sessions": [
    {
      "id": "1",
      "state": "active",
      "messages": [{"role": "user", "content": "test"}]
    }
  ]
}

# 检查数据库中的 sessions 字段
# 应该不包含 messages
{
  "sessions": [
    {
      "id": "1",
      "state": "active"
      // messages 不存在
    }
  ]
}
```

### 3. 验证消息可以通过 Conversation API 获取

```bash
# 创建对话后获取消息
GET /v1/conversation/get?conversation_id=xxx

# 应该返回完整的 message 列表
{
  "code": 0,
  "data": {
    "message": [...]
  }
}
```

---

**文档版本**: v2.0  
**更新日期**: 2025-01-11  
**作者**: Claude + 开发团队  
**变更**: 添加 API 文档和前端实现示例
