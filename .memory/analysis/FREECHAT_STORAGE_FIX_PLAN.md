# FreeChat 存储架构修复执行计划

**制定日期**: 2025-01-11  
**执行优先级**: P0 (紧急)  
**预计工作量**: 2-3 天  
**风险等级**: 🔴 高（涉及架构变更）

---

## 🎯 修复目标

### 核心目标

1. **建立单一数据源（Single Source of Truth）**
   - SQL 的 `Conversation` 表是唯一权威数据源
   - 前端 `sessions` 仅作为缓存层

2. **解决数据一致性问题**
   - 消除双重存储
   - 统一保存时机
   - 保证强一致性

3. **修复 BUG FIX #10 引入的副作用**
   - 支持从 URL 加载会话
   - 避免循环更新

### 非目标（暂不处理）

- ❌ 不改变 `FreeChatUserSettings` 表结构（保持向后兼容）
- ❌ 不迁移现有数据（新架构对现有数据无影响）
- ❌ 不优化性能（先保证正确性）

---

## 📋 修复方案

### 方案选择

#### ❌ 方案A: 完全移除 FreeChatUserSettings.sessions

**优点**:
- 数据源唯一，架构清晰
- 无数据一致性问题

**缺点**:
- ⛔ 需要迁移现有数据
- ⛔ 破坏向后兼容性
- ⛔ 需要修改后端 API
- ⛔ 工作量巨大（5+ 天）

**结论**: ❌ **不采用** - 风险太高，工作量大

---

#### ✅ 方案B: 重新定义数据所有权（推荐）

**核心思想**:
```
FreeChatUserSettings.sessions 只存储轻量级元数据
  ↓
Conversation 表存储完整消息历史
  ↓
前端从 Conversation API 加载消息
```

**数据所有权划分**:

| 数据项 | 存储位置 | 职责 |
|--------|---------|------|
| `session.id` | FreeChatUserSettings | 前端会话标识 |
| `session.conversation_id` | FreeChatUserSettings | 关联后端会话 |
| `session.model_card_id` | FreeChatUserSettings | 模型卡绑定 |
| `session.name` | FreeChatUserSettings | 会话名称（快速加载） |
| `session.params` | FreeChatUserSettings | 参数覆盖 |
| `session.created_at` | FreeChatUserSettings | 创建时间 |
| `session.updated_at` | FreeChatUserSettings | 更新时间 |
| **`session.messages`** | ❌ **移除** | 从 Conversation API 加载 |

**新的数据流**:

```
用户切换会话
  ↓
switchSession(sessionId)
  ↓
【关键变化】清空 derivedMessages，显示 Loading
  ↓
if (session.conversation_id) {
  API: GET /v1/conversation/get?conversation_id=xxx
} else {
  derivedMessages = []  // 新会话，无消息
}
  ↓
setDerivedMessages(response.data.message)
  ↓
用户看到消息
```

**优点**:
- ✅ 消除双重存储
- ✅ SQL 是唯一权威数据源
- ✅ 无数据一致性问题
- ✅ 向后兼容（旧 sessions 仍能加载）
- ✅ 修复 BUG FIX #10 副作用

**缺点**:
- ⚠️ 切换会话需要 API 请求（性能稍差）
- ⚠️ 需要增加加载状态

**结论**: ✅ **采用** - 平衡了正确性和工作量

---

## 🔧 具体修复步骤

### 阶段1: 数据结构调整（30分钟）

#### 步骤1.1: 修改 IFreeChatSession 接口

**文件**: `web/src/pages/free-chat/hooks/use-free-chat-session.ts`

**修改前**:
```typescript
export interface IFreeChatSession {
  id: string;
  conversation_id?: string;
  model_card_id?: number;
  name: string;
  messages: Message[];  // ← 移除
  created_at: number;
  updated_at: number;
  params?: DynamicModelParams;
}
```

**修改后**:
```typescript
export interface IFreeChatSession {
  id: string;
  conversation_id?: string;
  model_card_id?: number;
  name: string;
  // REMOVED: messages - now loaded from Conversation API on demand
  created_at: number;
  updated_at: number;
  params?: DynamicModelParams;
}
```

#### 步骤1.2: 移除消息同步逻辑

**文件**: `web/src/pages/free-chat/hooks/use-free-chat.ts`

**删除代码** (Line 217-256):
```typescript
// BUG FIX #1, #9 & #13: Properly sync derivedMessages to session storage
// 【删除整个 useEffect】
useEffect(() => {
  const sessionId = currentSessionIdRef.current;
  if (sessionId && derivedMessages.length > 0 && !isSyncingRef.current) {
    // ... 删除所有逻辑
  }
}, [derivedMessages, updateSession]);
```

**原因**: `derivedMessages` 不再同步到 `session.messages`

---

### 阶段2: 实现消息按需加载（1.5小时）

#### 步骤2.1: 创建 useLoadConversationMessages Hook

**文件**: `web/src/pages/free-chat/hooks/use-load-conversation-messages.ts` (新建)

**代码**:
```typescript
import { useState, useCallback } from 'react';
import { Message } from '@/interfaces/database/chat';
import chatService from '@/services/next-chat-service';
import { logError, logInfo } from '../utils/error-handler';

interface UseLoadConversationMessagesReturn {
  loadMessages: (conversationId: string) => Promise<Message[] | null>;
  loading: boolean;
  error: string | null;
}

export const useLoadConversationMessages = (): UseLoadConversationMessagesReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (conversationId: string): Promise<Message[] | null> => {
    if (!conversationId) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      logInfo(`Loading messages for conversation: ${conversationId}`, 'useLoadConversationMessages');

      const { data } = await chatService.getConversation(
        { params: { conversation_id: conversationId } },
        true
      );

      if (data.code === 0 && data.data) {
        const messages = data.data.message || [];
        logInfo(`Loaded ${messages.length} messages`, 'useLoadConversationMessages');
        return messages;
      } else {
        const errorMsg = data.message || 'Failed to load conversation';
        logError(errorMsg, 'useLoadConversationMessages');
        setError(errorMsg);
        return null;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      logError(errorMsg, 'useLoadConversationMessages');
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loadMessages,
    loading,
    error,
  };
};
```

#### 步骤2.2: 在 useFreeChat 中集成消息加载

**文件**: `web/src/pages/free-chat/hooks/use-free-chat.ts`

**修改位置**: Line 77-85

**修改前**:
```typescript
// BUG FIX #10: Only sync when currentSessionId changes
useEffect(() => {
  if (currentSession) {
    setDerivedMessages(currentSession.messages || []);
  } else {
    setDerivedMessages([]);
  }
}, [currentSessionId, setDerivedMessages]);
```

**修改后**:
```typescript
import { useLoadConversationMessages } from './use-load-conversation-messages';

// ... 在 useFreeChat 函数内部

const { loadMessages, loading: messagesLoading } = useLoadConversationMessages();
const [isLoadingMessages, setIsLoadingMessages] = useState(false);

// FIX: Load messages from Conversation API when session changes
// This solves both BUG FIX #10 and URL conversation loading issues
useEffect(() => {
  const loadSessionMessages = async () => {
    if (!currentSession) {
      setDerivedMessages([]);
      return;
    }

    // If session has conversation_id, load messages from backend
    if (currentSession.conversation_id) {
      setIsLoadingMessages(true);
      try {
        const messages = await loadMessages(currentSession.conversation_id);
        if (messages) {
          setDerivedMessages(messages);
          logInfo(
            `Loaded ${messages.length} messages for session ${currentSession.id}`,
            'useFreeChat.loadSessionMessages'
          );
        } else {
          // Failed to load, use empty messages
          setDerivedMessages([]);
        }
      } finally {
        setIsLoadingMessages(false);
      }
    } else {
      // New session without conversation_id, start with empty messages
      setDerivedMessages([]);
    }
  };

  loadSessionMessages();
}, [currentSessionId, currentSession?.conversation_id, loadMessages, setDerivedMessages]);
```

**关键点**:
- ✅ 依赖 `currentSessionId` 和 `conversation_id`（而非整个 `currentSession` 对象）
- ✅ 有 `conversation_id` → 从 API 加载
- ✅ 无 `conversation_id` → 空消息（新会话）
- ✅ 解决 BUG FIX #10 的副作用

#### 步骤2.3: 移除 onSessionsChange 回调

**文件**: `web/src/pages/free-chat/hooks/use-free-chat-session.ts`

**修改**: 移除 `saveSessions()` 调用中的消息序列化

**修改前** (Line 40-53):
```typescript
const saveSessions = useCallback(
  (sessions: IFreeChatSession[]) => {
    if (onSessionsChange) {
      onSessionsChange(sessions);  // ← 包含完整 messages
    }
  },
  [onSessionsChange],
);
```

**修改后**:
```typescript
const saveSessions = useCallback(
  (sessions: IFreeChatSession[]) => {
    if (onSessionsChange) {
      // IMPORTANT: Sessions no longer contain messages
      // Messages are loaded from Conversation API on demand
      onSessionsChange(sessions);
    }
  },
  [onSessionsChange],
);
```

**注意**: `IFreeChatSession` 已移除 `messages` 字段，无需额外处理

---

### 阶段3: 更新会话创建和更新逻辑（1小时）

#### 步骤3.1: 修改 updateSession 调用

**文件**: `web/src/pages/free-chat/hooks/use-free-chat.ts`

**查找所有 `updateSession()` 调用，移除 `messages` 参数**:

**示例1** (Line 172-175):
```typescript
// 修改前
if (convData.code === 0) {
  conversationId = convData.data.id;
  updateSession(currentSession.id, { 
    conversation_id: conversationId,
    // messages 字段已从 IFreeChatSession 移除，无需更新
  });
}
```

**示例2** (index.tsx:242-249):
```typescript
// 修改前
updateSession(newSession.id, {
  conversation_id: conversationId,
  messages: conversation.message,  // ← 移除此行
});

// 修改后
updateSession(newSession.id, {
  conversation_id: conversationId,
  // Messages will be loaded automatically when switching to this session
});
```

#### 步骤3.2: 移除 FreeChatUserSettings.sessions 的消息字段

**文件**: `web/src/pages/free-chat/hooks/use-free-chat-settings-api.ts`

**无需修改**: TypeScript 类型检查会自动阻止保存 `messages` 字段

**验证**:
```typescript
// 这行代码会通过 TypeScript 检查（messages 已从接口移除）
updateField('sessions', sessions, { silent: true });
```

---

### 阶段4: 添加加载状态和错误处理（30分钟）

#### 步骤4.1: 在 SimplifiedMessageInput 显示加载状态

**文件**: `web/src/pages/free-chat/components/simplified-message-input.tsx`

**修改** (Line 69-77):
```typescript
{/* Warning Message */}
{disabled && !isLoadingMessages && (
  <div className="mb-2 text-xs text-amber-600 dark:text-amber-500 text-center bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md py-1.5 px-3">
    ⚠️ 请先在左侧"助手"标签中选择一个助手
  </div>
)}

{/* Loading Message */}
{isLoadingMessages && (
  <div className="mb-2 text-xs text-blue-600 dark:text-blue-500 text-center bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md py-1.5 px-3">
    ⏳ 加载消息中...
  </div>
)}
```

#### 步骤4.2: 在 ChatInterface 显示加载骨架

**文件**: `web/src/pages/free-chat/chat-interface.tsx`

**修改**:
```tsx
import { Spin } from 'antd';

// 在消息列表渲染前添加
{isLoadingMessages ? (
  <div className="flex justify-center items-center h-64">
    <Spin tip="加载对话历史..." />
  </div>
) : (
  derivedMessages?.map((message, i) => (
    <MessageItem key={...} ... />
  ))
)}
```

---

### 阶段5: 测试和验证（1天）

#### 测试用例清单

##### 测试1: 新建会话
**步骤**:
1. 选择助手
2. 点击"新建对话"
3. 发送消息 "你好"
4. 查看响应

**预期**:
- ✅ 会话创建成功
- ✅ 消息正常发送和接收
- ✅ `session.conversation_id` 被设置
- ✅ `FreeChatUserSettings.sessions` 不包含 `messages` 字段

##### 测试2: 切换会话
**步骤**:
1. 创建会话 A，发送消息 "A1"
2. 创建会话 B，发送消息 "B1"
3. 切换回会话 A

**预期**:
- ✅ 显示加载状态（⏳ 加载消息中...）
- ✅ 从 Conversation API 加载消息
- ✅ 显示消息 "A1"
- ✅ 无数据丢失

##### 测试3: 从 URL 加载会话
**步骤**:
1. 获取现有会话的 `conversation_id`
2. 打开 URL: `/free-chat?conversation_id=xxx&auth=xxx`

**预期**:
- ✅ 会话加载成功
- ✅ 消息正确显示
- ✅ 修复 BUG FIX #10 副作用

##### 测试4: 刷新页面
**步骤**:
1. 发送消息
2. 立即刷新页面（不等待 5 秒防抖）

**预期**:
- ✅ 消息不丢失（从 Conversation 表加载）
- ✅ 会话列表正确恢复

##### 测试5: 删除会话
**步骤**:
1. 删除一个会话
2. 检查前端和后端

**预期**:
- ✅ 前端 `sessions` 移除该会话
- ✅ 后端 `Conversation` 表删除记录
- ✅ `FreeChatUserSettings` 更新

##### 测试6: 性能测试
**场景**:
- 10 个会话
- 每个会话 50 条消息

**预期**:
- ✅ 切换会话延迟 < 500ms
- ✅ 无内存泄漏
- ✅ 无重复请求

---

## 📊 修复前后对比

### 数据流对比

#### 修复前（当前）

```
用户发送消息 "你好"
  ↓
derivedMessages 更新
  ↓
updateSession(sessionId, { messages: derivedMessages })
  ↓ [5秒防抖]
updateField('sessions', sessions)
  ↓
POST /v1/free_chat/settings { sessions: [...完整消息...] }
  ↓
【同时】ConversationService.update_by_id(conv.id, conv.to_dict())
  ↓
【问题】两个地方都存储了完整消息，可能不一致
```

#### 修复后（新架构）

```
用户发送消息 "你好"
  ↓
derivedMessages 更新（内存中）
  ↓
【不再同步到 session.messages】
  ↓
ConversationService.update_by_id(conv.id, conv.to_dict())
  ↓
【唯一数据源】消息只存储在 Conversation 表

用户切换会话
  ↓
GET /v1/conversation/get?conversation_id=xxx
  ↓
setDerivedMessages(response.data.message)
  ↓
【单向数据流】从 SQL 加载，无同步冲突
```

### 存储空间对比

**修复前**:
```
FreeChatUserSettings: {
  sessions: [
    {
      id: "uuid-1",
      conversation_id: "conv-1",
      messages: [ /* 100条消息 */ ]  // ← 500KB
    }
  ]
}

Conversation 表: {
  id: "conv-1",
  message: [ /* 100条消息 */ ]  // ← 500KB
}

总计: 1MB（双重存储）
```

**修复后**:
```
FreeChatUserSettings: {
  sessions: [
    {
      id: "uuid-1",
      conversation_id: "conv-1"
      // messages 字段移除  // ← 0KB
    }
  ]
}

Conversation 表: {
  id: "conv-1",
  message: [ /* 100条消息 */ ]  // ← 500KB
}

总计: 500KB（单一存储）
```

**节省**: 50% 存储空间

---

## ⚠️ 风险评估

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| API 加载延迟影响体验 | 🟡 中 | 🟡 中 | 添加骨架屏，优化 API 性能 |
| 旧数据兼容性问题 | 🟢 低 | 🟢 低 | 旧 sessions 仍能加载（忽略 messages 字段） |
| 并发切换会话导致竞态 | 🟡 中 | 🟡 中 | 使用 AbortController 取消旧请求 |
| TypeScript 类型错误 | 🟢 低 | 🟢 低 | 编译时检查，逐步修复 |

### 回滚计划

如果修复失败，可以快速回滚：

1. 恢复 `IFreeChatSession.messages` 字段
2. 恢复消息同步 `useEffect`
3. 恢复旧的切换会话逻辑
4. 部署前端回滚版本

**回滚时间**: < 30 分钟

---

## 📅 执行时间表

### Day 1: 核心架构变更
- ✅ 上午: 阶段1 - 数据结构调整（30分钟）
- ✅ 上午: 阶段2 - 实现消息按需加载（1.5小时）
- ✅ 下午: 阶段3 - 更新会话创建和更新逻辑（1小时）
- ✅ 下午: 阶段4 - 添加加载状态和错误处理（30分钟）

### Day 2: 测试和验证
- ✅ 上午: 单元测试（所有测试用例）
- ✅ 下午: 集成测试（端到端流程）
- ✅ 晚上: 性能测试（大数据量）

### Day 3: 优化和发布
- ✅ 上午: 修复测试中发现的问题
- ✅ 下午: 代码审查和文档更新
- ✅ 晚上: 灰度发布（10% 用户）

---

## ✅ 验收标准

### 功能正确性

- ✅ 新建会话正常工作
- ✅ 切换会话正常加载消息
- ✅ 从 URL 加载会话正常显示
- ✅ 刷新页面不丢失消息
- ✅ 删除会话同时删除前后端数据

### 数据一致性

- ✅ `FreeChatUserSettings.sessions` 不包含 `messages` 字段
- ✅ 消息只存储在 `Conversation` 表
- ✅ 切换会话后消息与 SQL 一致

### 性能要求

- ✅ 切换会话延迟 < 500ms
- ✅ FreeChatUserSettings 大小减少 > 80%
- ✅ 无内存泄漏

### 用户体验

- ✅ 加载状态清晰可见
- ✅ 错误提示友好
- ✅ 无功能退化

---

## 🎯 总结

### 修复核心

1. **移除 `IFreeChatSession.messages` 字段**
   - 消息不再存储在前端 sessions
   - 从 Conversation API 按需加载

2. **建立单向数据流**
   - SQL → API → derivedMessages
   - 无双向同步，无竞态条件

3. **修复 BUG FIX #10 副作用**
   - 从 URL 加载会话正常工作
   - 依赖 `conversation_id` 而非整个 `currentSession` 对象

### 修复优势

- ✅ **一针见血**: 直接解决数据双重存储的根本问题
- ✅ **抓住关键**: 确立 SQL 为唯一权威数据源
- ✅ **风险可控**: 向后兼容，可快速回滚
- ✅ **工作量小**: 2-3 天完成核心修复

### 下一步行动

1. 获取用户批准执行计划
2. 创建功能分支 `fix/freechat-storage-architecture`
3. 按阶段执行修复
4. 逐个验证测试用例
5. 代码审查后合并到主分支

---

**执行计划制定人**: AI Agent (Claude)  
**遵循原则**: `.memory/agent/agent.md` 行为协议  
**分析依据**: `FREECHAT_INPUT_DISAPPEAR_ANALYSIS.md`
