# FreeChat Zustand Store 集成指南

## 📋 目录

1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [API参考](#api参考)
4. [集成步骤](#集成步骤)
5. [性能优化](#性能优化)
6. [故障排查](#故障排查)

---

## 快速开始

### 安装依赖

```bash
# Zustand 已经安装
# 版本: 4.5.2
```

### 基本使用

```typescript
import { useSessionStore } from './store/session';
import { useMessageStore } from './store/message';

function MyComponent() {
  // 获取会话状态
  const sessions = useSessionStore((state) => state.sessions);
  const currentSession = useSessionStore((state) => state.currentSession);
  
  // 获取操作函数
  const createSession = useSessionStore((state) => state.createSession);
  const updateSession = useSessionStore((state) => state.updateSession);
  
  // 获取消息
  const messages = useMessageStore((state) => 
    state.getMessages(currentSessionId)
  );
  
  return (
    <div>
      {/* 使用状态和操作 */}
    </div>
  );
}
```

---

## 核心概念

### 1. Session Store

**职责**: 管理所有会话状态

**数据结构**:
```typescript
interface SessionStore {
  // 状态
  sessions: IFreeChatSession[];
  currentSessionId: string;
  isLoading: boolean;
  currentSession: IFreeChatSession | undefined; // computed
  
  // 操作
  createSession(name?, model_card_id?): IFreeChatSession;
  updateSession(id, updates): void;
  deleteSession(id): void;
  switchSession(id): void;
  // ... more
}
```

**持久化**: 
- localStorage键: `freechat-session-storage`
- 持久化内容: sessions + currentSessionId

### 2. Message Store

**职责**: 独立管理消息状态

**数据结构**:
```typescript
interface MessageStore {
  // 状态: sessionId -> Message[]
  messages: Record<string, Message[]>;
  
  // 操作
  addMessage(sessionId, message): void;
  updateMessage(sessionId, messageId, updates): void;
  removeMessage(sessionId, messageId): void;
  // ... more
}
```

**持久化**:
- localStorage键: `freechat-message-storage`
- 持久化内容: 所有消息

### 3. 数据流

```
用户操作 → Store Action → State更新 → UI重新渲染
                ↓
           localStorage持久化
```

---

## API参考

### Session Store API

#### 基础操作

```typescript
// 创建会话
const newSession = createSession('会话名称', modelCardId);

// 更新会话
updateSession(sessionId, {
  name: '新名称',
  model_card_id: 123,
  messages: [...],
  params: { temperature: 0.8 },
});

// 删除会话
deleteSession(sessionId);

// 切换会话
switchSession(sessionId);

// 清空所有会话
clearAllSessions();
```

#### 高级操作

```typescript
// 复制会话
const duplicated = duplicateSession(sessionId, '副本名称');

// 只更新消息
updateSessionMessages(sessionId, messages);

// 只更新参数
updateSessionParams(sessionId, { temperature: 0.9 });

// 获取特定会话
const session = getSessionById(sessionId);
```

### Message Store API

#### 基础操作

```typescript
// 设置消息
setMessages(sessionId, messages);

// 添加消息
addMessage(sessionId, {
  id: uuid(),
  role: 'user',
  content: '你好',
});

// 更新消息
updateMessage(sessionId, messageId, {
  content: '更新的内容',
});

// 删除消息
removeMessage(sessionId, messageId);

// 清空会话消息
clearMessages(sessionId);
```

#### 便捷方法

```typescript
// 添加用户消息
const userMsg = addUserMessage(sessionId, '你好');

// 添加助手消息
const assistantMsg = addAssistantMessage(sessionId, '你好！', reference);

// 更新最后一条助手消息 (流式更新)
updateLastAssistantMessage(sessionId, '你好！我是...', reference);

// 删除最后一条消息
removeLatestMessage(sessionId);
```

### Selectors (推荐)

```typescript
import { sessionSelectors, messageSelectors } from './store';

// 使用selectors
const currentSession = useSessionStore(sessionSelectors.currentSession);
const sessions = useSessionStore(sessionSelectors.sessions);
const hasSession = useSessionStore(sessionSelectors.hasSession);

const messages = useMessageStore(messageSelectors.getMessages(sessionId));
const hasMessages = useMessageStore(messageSelectors.hasMessages(sessionId));
```

---

## 集成步骤

### Step 1: 使用 Enhanced Hook (推荐)

最简单的方式是使用我们提供的 `useFreeChatEnhanced` hook:

```typescript
// index.tsx
import { useFreeChatEnhanced } from './hooks/use-free-chat-enhanced';

function FreeChatPage() {
  const controller = new AbortController();
  
  const {
    // 消息相关
    derivedMessages,
    handlePressEnter,
    value,
    handleInputChange,
    
    // 会话管理
    sessions,
    currentSession,
    createSession,
    switchSession,
    
    // 其他
    sendLoading,
  } = useFreeChatEnhanced(controller, {
    userId,
    settings,
    onSessionsChange: (sessions) => {
      // 保存到后端API
      updateField('sessions', sessions);
    },
  });
  
  return (
    // 使用状态和操作
  );
}
```

### Step 2: 直接使用 Store (高级)

如果需要更细粒度的控制:

```typescript
import { useSessionStore } from './store/session';
import { useMessageStore } from './store/message';

function MyComponent() {
  // 订阅特定状态 (性能优化)
  const sessions = useSessionStore((state) => state.sessions);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  
  // 获取操作函数 (稳定引用，不会导致重渲染)
  const createSession = useSessionStore((state) => state.createSession);
  const switchSession = useSessionStore((state) => state.switchSession);
  
  // 获取当前会话的消息
  const messages = useMessageStore((state) => 
    state.getMessages(currentSessionId)
  );
  
  const handleNewSession = () => {
    const newSession = createSession('新对话', modelCardId);
    // newSession.id 可以立即使用
  };
  
  return (
    <div>
      {sessions.map(session => (
        <SessionItem 
          key={session.id}
          session={session}
          onClick={() => switchSession(session.id)}
        />
      ))}
    </div>
  );
}
```

### Step 3: 同步到后端API

```typescript
import { useSessionStore } from './store/session';
import { useEffect } from 'react';

function SyncToBackend() {
  const sessions = useSessionStore((state) => state.sessions);
  
  // 方案A: 使用防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      // 保存到后端
      fetch('/api/save-sessions', {
        method: 'POST',
        body: JSON.stringify({ sessions }),
      });
    }, 5000); // 5秒防抖
    
    return () => clearTimeout(timer);
  }, [sessions]);
  
  // 方案B: 使用 onSessionsChange 回调
  // 见 useFreeChatEnhanced 示例
}
```

---

## 性能优化

### 1. 使用 Selectors

**❌ 不好的做法** (整个store变化都会重渲染):
```typescript
const store = useSessionStore();
const sessions = store.sessions;
```

**✅ 好的做法** (只在sessions变化时重渲染):
```typescript
const sessions = useSessionStore((state) => state.sessions);
```

### 2. 使用 useShallow (避免对象引用导致的重渲染)

```typescript
import { useShallow } from 'zustand/react/shallow';

// ❌ 每次都会重渲染 (对象引用变化)
const { sessions, currentSession } = useSessionStore((state) => ({
  sessions: state.sessions,
  currentSession: state.currentSession,
}));

// ✅ 只在值变化时重渲染
const { sessions, currentSession } = useSessionStore(
  useShallow((state) => ({
    sessions: state.sessions,
    currentSession: state.currentSession,
  }))
);
```

### 3. 分离操作和状态

```typescript
// ✅ 操作函数不会导致重渲染
const createSession = useSessionStore((state) => state.createSession);

// ✅ 只订阅需要的状态
const currentSessionId = useSessionStore((state) => state.currentSessionId);
```

### 4. 使用 Computed Values

```typescript
// Store内部已经提供computed
const currentSession = useSessionStore((state) => state.currentSession);

// 避免在组件中计算
// ❌ 每次渲染都计算
const currentSession = sessions.find(s => s.id === currentSessionId);
```

---

## 故障排查

### 问题1: 状态没有持久化

**症状**: 刷新页面后状态丢失

**检查**:
```typescript
// 1. 确认localStorage中有数据
localStorage.getItem('freechat-session-storage');
localStorage.getItem('freechat-message-storage');

// 2. 确认persist中间件配置正确
// 查看 store/session.ts 和 store/message.ts
```

**解决**:
- 确保不在test环境运行
- 检查浏览器localStorage是否被禁用
- 清除localStorage重试: `localStorage.clear()`

### 问题2: DevTools无法使用

**症状**: Redux DevTools无法连接

**检查**:
```typescript
// 确认开发环境
console.log(process.env.NODE_ENV); // 应该是 'development'

// 确认 DevTools 扩展已安装
```

**解决**:
- 安装 Redux DevTools 浏览器扩展
- 确认在开发环境运行
- 重启开发服务器

### 问题3: 性能问题 / 不必要的重渲染

**诊断**:
```typescript
// 使用 React DevTools Profiler
// 或添加日志
const sessions = useSessionStore((state) => {
  console.log('Sessions selector called');
  return state.sessions;
});
```

**解决**:
- 使用选择器模式
- 使用 `useShallow`
- 分离状态订阅和操作获取

### 问题4: 消息不同步

**症状**: Message Store和Session Store中的消息不一致

**解决**:
```typescript
// 使用 Enhanced Hook 会自动同步
// 或者手动同步:
useEffect(() => {
  if (currentSessionId && messages.length > 0) {
    updateSession(currentSessionId, { messages });
  }
}, [messages, currentSessionId, updateSession]);
```

---

## 最佳实践

### 1. 使用 Enhanced Hook

✅ **推荐**: 使用 `useFreeChatEnhanced`
```typescript
const freechat = useFreeChatEnhanced(controller, props);
```

❌ **不推荐**: 直接混用多个hooks
```typescript
const session = useFreeChatSession();
const { addMessage } = useMessageStore();
// 需要手动同步...
```

### 2. 单一数据源

✅ **推荐**: 所有会话状态来自 Store
```typescript
const sessions = useSessionStore((state) => state.sessions);
```

❌ **不推荐**: 混用useState和Store
```typescript
const [localSessions, setLocalSessions] = useState([]);
const storeSessions = useSessionStore((state) => state.sessions);
// 两个数据源可能不一致
```

### 3. 类型安全

✅ **推荐**: 使用类型
```typescript
import type { IFreeChatSession } from './store/session';

const session: IFreeChatSession = createSession('name', 123);
```

### 4. 错误处理

```typescript
try {
  const session = createSession('name', modelCardId);
  // 使用session
} catch (error) {
  console.error('Failed to create session:', error);
  // 用户提示
}
```

---

## 下一步

1. ✅ 阅读本指南
2. ✅ 查看 `FINAL_SUMMARY.md` 了解整体架构
3. ✅ 使用 `useFreeChatEnhanced` 集成
4. ✅ 测试所有功能
5. ✅ 使用 DevTools 调试
6. ✅ 优化性能

---

## 参考资源

- [Zustand 官方文档](https://github.com/pmndrs/zustand)
- [Lobe Chat 源码](https://github.com/lobehub/lobe-chat)
- `FINAL_SUMMARY.md` - 项目总结
- `MIGRATION_SUMMARY.md` - 迁移说明
- `URGENT_BUGFIX.md` - Bug修复指南

---

**最后更新**: 2025-01-10  
**维护者**: Claude AI Agent
