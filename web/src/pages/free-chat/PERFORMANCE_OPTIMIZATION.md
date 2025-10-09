# FreeChat 性能优化指南

## 🚀 优化策略

### 1. 使用优化的Hooks

我们创建了 `store/hooks.ts`，提供了预优化的hooks，避免不必要的重渲染。

#### ❌ 不推荐的做法

```typescript
// 问题: 整个store变化都会重渲染
const store = useSessionStore();
const sessions = store.sessions;

// 问题: 对象引用每次都变化，导致重渲染
const { sessions, currentSession } = useSessionStore((state) => ({
  sessions: state.sessions,
  currentSession: state.currentSession,
}));
```

#### ✅ 推荐的做法

```typescript
import { 
  useSessions, 
  useCurrentSession,
  useSessionActions 
} from './store/hooks';

function MyComponent() {
  // ✅ 只在sessions数组变化时重渲染
  const sessions = useSessions();
  
  // ✅ 只在currentSession变化时重渲染
  const currentSession = useCurrentSession();
  
  // ✅ 稳定的引用，不会导致重渲染
  const { createSession, updateSession } = useSessionActions();
  
  return (
    <div>
      {sessions.map(session => (
        <SessionItem key={session.id} session={session} />
      ))}
    </div>
  );
}
```

---

### 2. 使用Combined Hooks

对于复杂组件，使用combined hooks一次获取所有需要的状态。

```typescript
import { useChatState } from './store/hooks';

function ChatInterface() {
  const {
    // State
    currentSessionId,
    currentSession,
    sessions,
    messages,
    
    // Actions
    createSession,
    updateSession,
    addUserMessage,
    addAssistantMessage,
  } = useChatState();
  
  // 所有状态和操作都已优化
  return <div>...</div>;
}
```

---

### 3. 分离状态和操作

```typescript
// ✅ 好的做法: 分离状态和操作订阅
function SessionList() {
  // 只订阅需要的状态 - 会导致重渲染
  const sessions = useSessions();
  
  // 获取操作函数 - 不会导致重渲染
  const { createSession, deleteSession } = useSessionActions();
  
  // 这个组件只在sessions变化时重渲染
  return (
    <div>
      <button onClick={() => createSession()}>新建</button>
      {sessions.map(session => (
        <div key={session.id}>
          {session.name}
          <button onClick={() => deleteSession(session.id)}>删除</button>
        </div>
      ))}
    </div>
  );
}
```

---

### 4. 使用React.memo优化子组件

```typescript
import React, { memo } from 'react';
import type { IFreeChatSession } from './store/session';

interface SessionItemProps {
  session: IFreeChatSession;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

// ✅ 使用memo避免父组件重渲染时子组件也重渲染
export const SessionItem = memo<SessionItemProps>(({ 
  session, 
  onSelect, 
  onDelete 
}) => {
  console.log('[SessionItem] Rendered:', session.name);
  
  return (
    <div onClick={() => onSelect(session.id)}>
      <h3>{session.name}</h3>
      <p>{session.messages.length} messages</p>
      <button onClick={(e) => {
        e.stopPropagation();
        onDelete(session.id);
      }}>
        删除
      </button>
    </div>
  );
});

// ✅ 使用useCallback稳定回调函数引用
function SessionList() {
  const sessions = useSessions();
  const { switchSession, deleteSession } = useSessionActions();
  
  // useCallback确保引用稳定，避免SessionItem重渲染
  const handleSelect = useCallback((id: string) => {
    switchSession(id);
  }, [switchSession]);
  
  const handleDelete = useCallback((id: string) => {
    deleteSession(id);
  }, [deleteSession]);
  
  return (
    <div>
      {sessions.map(session => (
        <SessionItem
          key={session.id}
          session={session}
          onSelect={handleSelect}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
```

---

### 5. 虚拟滚动优化长列表

对于大量消息的场景，使用虚拟滚动：

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMessages } from './store/hooks';

function MessageList({ sessionId }: { sessionId: string }) {
  const messages = useMessages(sessionId);
  const parentRef = useRef<HTMLDivElement>(null);
  
  // ✅ 使用虚拟滚动，只渲染可见的消息
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 估计每条消息高度
    overscan: 5, // 预渲染5条消息
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => {
          const message = messages[virtualItem.index];
          return (
            <div
              key={message.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <MessageItem message={message} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### 6. 使用useMemo缓存计算结果

```typescript
import { useMemo } from 'react';
import { useSessions } from './store/hooks';

function SessionStats() {
  const sessions = useSessions();
  
  // ✅ 使用useMemo缓存计算结果
  const stats = useMemo(() => {
    return {
      total: sessions.length,
      withMessages: sessions.filter(s => s.messages.length > 0).length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
      avgMessages: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + s.messages.length, 0) / sessions.length 
        : 0,
    };
  }, [sessions]); // 只在sessions变化时重新计算
  
  return (
    <div>
      <p>总会话: {stats.total}</p>
      <p>有消息的会话: {stats.withMessages}</p>
      <p>总消息数: {stats.totalMessages}</p>
      <p>平均消息数: {stats.avgMessages.toFixed(1)}</p>
    </div>
  );
}
```

---

### 7. 懒加载和代码分割

```typescript
import { lazy, Suspense } from 'react';

// ✅ 懒加载不常用的组件
const ControlPanel = lazy(() => import('./components/control-panel'));
const SessionSettings = lazy(() => import('./components/session-settings'));

function FreeChat() {
  const [showSettings, setShowSettings] = useState(false);
  
  return (
    <div>
      <ChatInterface />
      
      {/* 只在需要时加载 */}
      <Suspense fallback={<div>加载中...</div>}>
        {showSettings && <SessionSettings />}
      </Suspense>
    </div>
  );
}
```

---

### 8. 防抖和节流

```typescript
import { useCallback, useRef } from 'react';

// 防抖Hook
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
}

// 使用示例
function SearchMessages() {
  const [keyword, setKeyword] = useState('');
  const messages = useMessages(currentSessionId);
  
  // ✅ 防抖搜索，减少计算
  const handleSearch = useDebounce((value: string) => {
    console.log('Searching for:', value);
    // 执行搜索逻辑
  }, 300);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    handleSearch(value);
  };
  
  return (
    <input
      value={keyword}
      onChange={handleChange}
      placeholder="搜索消息..."
    />
  );
}
```

---

## 📊 性能监控

### 使用性能监控Hook

```typescript
import { usePerformanceMonitor } from './store/hooks';

function MyComponent() {
  // 开发环境自动记录渲染
  usePerformanceMonitor('MyComponent');
  
  return <div>...</div>;
}
```

### 使用React DevTools Profiler

```typescript
import { Profiler } from 'react';

function App() {
  const onRenderCallback = (
    id: string,
    phase: 'mount' | 'update',
    actualDuration: number,
  ) => {
    console.log(`[Profiler] ${id} ${phase}:`, actualDuration);
  };
  
  return (
    <Profiler id="FreeChat" onRender={onRenderCallback}>
      <FreeChat />
    </Profiler>
  );
}
```

---

## 🎯 性能优化检查清单

### 组件级别

- [ ] 使用优化的hooks (`store/hooks.ts`)
- [ ] 使用`React.memo`包装纯组件
- [ ] 使用`useCallback`稳定回调函数
- [ ] 使用`useMemo`缓存计算结果
- [ ] 避免在render中创建新对象/数组
- [ ] 避免匿名函数作为props

### Store级别

- [ ] 使用selectors而非直接访问state
- [ ] 分离状态订阅和操作获取
- [ ] 避免订阅不需要的状态
- [ ] 使用`useShallow`避免引用变化

### 列表渲染

- [ ] 使用正确的key (稳定且唯一)
- [ ] 考虑虚拟滚动 (100+项)
- [ ] 懒加载列表项
- [ ] 分页加载数据

### 数据处理

- [ ] 使用防抖处理用户输入
- [ ] 使用节流处理滚动事件
- [ ] 异步处理大数据计算
- [ ] 缓存API响应

---

## 📈 性能基准

### 目标指标

| 指标 | 目标值 | 测量方法 |
|------|--------|---------|
| 首次渲染时间 | < 1s | Chrome DevTools Performance |
| 切换会话时间 | < 100ms | console.time |
| 发送消息延迟 | < 50ms | console.time |
| 重渲染次数 | 最小化 | React DevTools Profiler |
| 内存使用 | < 100MB | Chrome DevTools Memory |

### 测试场景

1. **轻量级场景**: 5个会话，每个10条消息
2. **中等场景**: 20个会话，每个50条消息
3. **重量级场景**: 50个会话，每个100条消息

---

## 🔍 性能问题诊断

### 问题1: 组件频繁重渲染

**诊断**:
```typescript
// 添加日志
console.log('[Component] Rendered');
```

**解决**:
- 检查是否使用了优化的hooks
- 检查是否使用了useShallow
- 使用React.memo
- 使用useCallback/useMemo

### 问题2: 切换会话卡顿

**诊断**:
```typescript
console.time('switchSession');
switchSession(id);
console.timeEnd('switchSession');
```

**解决**:
- 使用虚拟滚动
- 懒加载消息
- 优化消息渲染

### 问题3: 内存泄漏

**诊断**:
- Chrome DevTools Memory → Take Heap Snapshot
- 查找Detached DOM nodes
- 查找未清理的监听器

**解决**:
- 清理useEffect中的订阅
- 清理setTimeout/setInterval
- 避免闭包引用大对象

---

## 💡 最佳实践总结

1. **始终使用优化的hooks** (`store/hooks.ts`)
2. **避免不必要的重渲染** (memo, useCallback, useMemo)
3. **分离状态和操作** (减少重渲染)
4. **使用虚拟滚动** (长列表优化)
5. **懒加载组件** (减少初始加载时间)
6. **防抖/节流** (优化用户交互)
7. **监控性能** (DevTools + Profiler)

---

**下一步**: 参考 `USAGE_EXAMPLES.md` 查看优化后的代码示例
