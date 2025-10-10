# FreeChat 重构方案
**日期:** 2025-01-11  
**目标:** 修复架构问题并符合最佳实践

---

## 一、核心问题总结

### 🔴 严重问题

1. **双重状态源头问题**
   - Zustand 和 XState 同时维护 session 数据
   - 导致需要手动同步（`onPromotionSuccess` 回调）
   - 产生竞态条件和同步 bug

2. **轮询反模式**
   - `use-free-chat-with-machine.ts` 中手动轮询 `conversationId`
   - 违背状态机设计原则
   - 增加不必要的复杂度

3. **服务硬编码**
   - API 调用写死在 machine 定义中
   - 无法测试、无法复用
   - SSR/Hydration 问题

### 🟡 次要问题

4. **手动订阅管理**
   - 使用 `service.subscribe()` 代替 `useActor`
   - 增加代码复杂度

5. **缺少 Immer 中间件**
   - 嵌套状态更新代码冗长
   - 容易出错

6. **多个 useEffect 同步逻辑**
   - 三个独立的 effect 处理消息同步
   - 依赖链难以调试

---

## 二、重构策略

### 策略选择：**Zustand 为主，XState 为辅**

**理由：**
1. 当前大部分数据已经在 Zustand 中（sessions, messages）
2. XState 只需管理状态转换逻辑，不存储数据
3. 重构成本低于"XState 为主"方案
4. 符合 TanStack Query 文档推荐的"UI 状态用 local state，服务器状态用 query"原则

**新架构：**
```
┌─────────────────────────────────────────┐
│          Zustand Store (状态存储)         │
│  - sessions[]                           │
│  - currentSessionId                     │
│  - messages (每个 session)               │
│  - 所有 CRUD 操作                        │
└─────────────────────────────────────────┘
                    ↑
                    │ 状态更新
                    │
┌─────────────────────────────────────────┐
│     XState Machine (转换编排器)          │
│  - 只管理状态：idle/draft/promoting/    │
│    active/failed                        │
│  - 触发 API 调用                         │
│  - 通过 actions 更新 Zustand             │
└─────────────────────────────────────────┘
                    ↑
                    │ 用户操作
                    │
┌─────────────────────────────────────────┐
│         React Components                │
│  - 读取 Zustand                          │
│  - 发送事件到 XState                     │
└─────────────────────────────────────────┘
```

---

## 三、详细修改方案

### 修改 1: 重新设计 Session Machine

**文件:** `web/src/pages/free-chat/machines/session-machine.ts`

**改动：**
```typescript
// ❌ 旧方案：machine 存储数据
export interface SessionContext {
  sessionId: string;
  conversationId?: string;
  messages: Message[];  // ❌ 移除
  // ...
}

// ✅ 新方案：machine 只存储状态转换所需的最小信息
export interface SessionContext {
  sessionId: string;
  promotingToConversationId?: string;  // 临时存储，promotion 完成后清空
  error?: Error;
}

// ❌ 旧方案：硬编码 service
const services = {
  promoteDraftToActive: async (context, event) => {
    const response = await fetch('/v1/conversation/set', { ... });
  }
};

// ✅ 新方案：service 引用（注入点）
export const sessionMachine = createMachine({
  // ...
}, {
  services: {
    promoteDraftToActive: 'promoteDraftToActive'  // 字符串引用
  }
});
```

**新机制：**
- Machine 不存储 messages、name、params 等业务数据
- 只存储状态转换临时需要的数据（promotingToConversationId）
- 所有业务数据在 Zustand 中维护

---

### 修改 2: Zustand Store 添加 Immer 中间件

**文件:** `web/src/pages/free-chat/store/session.ts`

**改动：**
```typescript
import { immer } from 'zustand/middleware/immer';

// ✅ 添加 Immer 到中间件链
export const useSessionStore = create<SessionStore>()(
  persist(
    devtools(
      immer((set, get) => ({
        sessions: [],
        
        // ✅ 简化嵌套更新
        updateSession: (id, updates) => set((state) => {
          const session = state.sessions.find(s => s.id === id);
          if (session) {
            Object.assign(session, updates);
            session.updated_at = Date.now();
          }
        }),
        
        // ✅ 简化数组操作
        addMessage: (sessionId, message) => set((state) => {
          const session = state.sessions.find(s => s.id === sessionId);
          if (session) {
            session.messages.push(message);
            session.updated_at = Date.now();
          }
        }),
      }))
    ),
    {
      name: 'FreeChat_Session',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);
```

**优势：**
- 代码更清晰（直接 push、赋值）
- 性能更好（Immer 智能 diff）
- 减少手动 `...` 扩展运算符

---

### 修改 3: 重构 useSessionMachine Hook

**文件:** `web/src/pages/free-chat/hooks/use-session-machine.ts`

**改动：**
```typescript
import { useActor } from '@xstate/react';
import { useSessionStore } from '../store/session';

export function useSessionMachine(props) {
  const { session } = props;
  const { updateSession } = useSessionStore();
  
  // ✅ 使用 useActor 代替 useMachine + 手动订阅
  const [state, send] = useActor(sessionMachine, {
    input: {
      sessionId: session?.id || '',
    },
    // ✅ 注入 services（可测试）
    services: {
      promoteDraftToActive: async (context, event) => {
        return await api.createConversation({
          dialog_id: event.dialogId,
          name: event.message.content.slice(0, 50),
          model_card_id: session?.model_card_id!,
        });
      },
    },
    // ✅ 注入 actions（更新 Zustand）
    actions: {
      updateStoreOnSuccess: (context, event) => {
        updateSession(context.sessionId, {
          conversation_id: event.data.conversationId,
          state: 'active',
        });
      },
    },
  });
  
  // ✅ 移除手动订阅
  // useEffect(() => {
  //   const subscription = service.subscribe(...);  // ❌ 删除
  // }, []);
  
  return {
    isDraft: state.matches('draft'),
    isPromoting: state.matches('promoting'),
    isActive: state.matches('active'),
    send,
  };
}
```

**优势：**
- 使用官方推荐的 `useActor` Hook
- Service 可注入 = 可测试
- Actions 直接更新 Zustand，无需回调

---

### 修改 4: 移除轮询逻辑

**文件:** `web/src/pages/free-chat/hooks/use-free-chat-with-machine.ts`

**改动：**
```typescript
const sendMessage = useCallback(async (message: Message) => {
  // ❌ 删除轮询
  // if (isDraft) {
  //   promoteToActive(message, dialogId);
  //   let retries = 0;
  //   while (!conversationId && retries < 50) { ... }  // ❌ 删除
  // }
  
  // ✅ 新方案：直接读取 Zustand 状态
  const session = useSessionStore.getState().sessions.find(s => s.id === currentSessionId);
  
  if (!session?.conversation_id && isDraft) {
    // 触发 promotion
    send({ type: 'PROMOTE_TO_ACTIVE', message, dialogId });
    // 不等待！让状态机自己管理转换
    return;
  }
  
  // 如果已经有 conversation_id（promotion 成功），正常发送
  if (session?.conversation_id) {
    await sendToBackend(message, session.conversation_id);
  }
}, [isDraft, send, currentSessionId]);
```

**配合 UI 变化：**
```tsx
// 组件中根据状态显示 UI
{isPromoting && <LoadingSpinner text="Creating conversation..." />}
{isActive && <MessageInput onSend={sendMessage} />}
```

**优势：**
- 状态机驱动 UI，自然流畅
- 无需轮询，消除竞态条件
- 代码更简洁

---

### 修改 5: 合并 useEffect 同步逻辑

**文件:** `web/src/pages/free-chat/hooks/use-free-chat.ts`

**改动：**
```typescript
// ❌ 旧方案：三个独立 effect
// useEffect(() => { /* Sync 1: Session ID → Load messages */ }, [currentSessionId]);
// useEffect(() => { /* Sync 2: Messages → Update session */ }, [derivedMessages]);
// useEffect(() => { /* Sync 3: Promotion state → Skip sync */ }, [isPromoting]);

// ✅ 新方案：单个 effect，清晰的逻辑分支
useEffect(() => {
  // Early exit: 正在 promoting，跳过所有同步
  if (isPromoting) return;
  
  // 场景 1: Session 切换 → 加载消息
  if (currentSessionId !== lastLoadedSessionIdRef.current) {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      setDerivedMessages(session.messages || []);
      lastLoadedSessionIdRef.current = currentSessionId;
    }
    return;
  }
  
  // 场景 2: 消息变化 → 持久化（仅 Active sessions）
  if (currentSession?.state === 'active') {
    const messagesChanged = /* ... diff logic ... */;
    if (messagesChanged) {
      debouncedUpdateSession(currentSessionId, { messages: derivedMessages });
    }
  }
}, [currentSessionId, derivedMessages, isPromoting, sessions]);
```

**优势：**
- 单一 effect，逻辑集中
- Early exit 避免嵌套
- 更易调试

---

### 修改 6: 添加 TanStack Query 集成（可选增强）

**背景：**  
当前已经有 `use-free-chat-session-query.ts`（已废弃），但 TanStack Query 更适合管理服务器状态。

**新文件:** `web/src/pages/free-chat/hooks/use-conversations-query.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ✅ 最佳实践：Queries 管理服务器状态
export function useConversationsQuery(dialogId: string, userId: string) {
  return useQuery({
    queryKey: ['conversations', dialogId, userId],
    queryFn: () => api.fetchConversations(dialogId, userId),
    staleTime: 5 * 60 * 1000,
    // ✅ 不轮询，只在用户操作时 refetch
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

// ✅ 最佳实践：Mutations 处理修改操作 + Optimistic Updates
export function useCreateConversationMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.createConversation(data),
    // ✅ Optimistic Update
    onMutate: async (newConversation) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previous = queryClient.getQueryData(['conversations']);
      
      // 立即更新 UI
      queryClient.setQueryData(['conversations'], (old) => [newConversation, ...old]);
      
      return { previous };
    },
    // ✅ 错误回滚
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversations'], context.previous);
      }
    },
    // ✅ 完成后同步
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
```

**集成到 Zustand：**
```typescript
// 在组件中
const { data: serverConversations } = useConversationsQuery(dialogId, userId);
const { sessions } = useSessionStore();

// 合并服务器状态和本地 Draft
const allSessions = useMemo(() => {
  const drafts = sessions.filter(s => s.state === 'draft');
  const active = serverConversations || [];
  return [...drafts, ...active];
}, [sessions, serverConversations]);
```

**优势：**
- 服务器状态自动同步
- Optimistic Updates 提升用户体验
- 自动缓存管理

---

## 四、文件修改清单

### 需要修改的文件

1. ✅ **session-machine.ts** (重新设计 context 和 services)
2. ✅ **use-session-machine.ts** (使用 useActor，注入 services)
3. ✅ **session.ts** (添加 Immer 中间件)
4. ✅ **use-free-chat-with-machine.ts** (移除轮询，使用状态驱动)
5. ✅ **use-free-chat.ts** (合并 effects)
6. 🆕 **use-conversations-query.ts** (可选：TanStack Query 集成)

### 需要安装的依赖

```bash
# 已安装
# - zustand@4.5.2 ✅
# - xstate@5.22.1 ✅
# - @xstate/react@6.0.0 ✅
# - @tanstack/react-query@5.40.0 ✅
# - immer@10.1.1 ✅

# 需要确认的
npm list zustand/middleware/immer  # 检查 Immer middleware 是否可用
```

---

## 五、迁移步骤（按优先级）

### 阶段 1: 核心架构修复（高优先级）

1. **步骤 1.1:** 修改 `session-machine.ts`
   - 精简 Context，移除业务数据
   - Service 改为字符串引用
   - 测试状态转换逻辑

2. **步骤 1.2:** 修改 `session.ts`
   - 添加 Immer 中间件
   - 简化 updateSession、addMessage 等操作
   - 测试 store 操作

3. **步骤 1.3:** 修改 `use-session-machine.ts`
   - 使用 `useActor` 替换 `useMachine`
   - 注入 services 和 actions
   - 移除手动订阅

4. **步骤 1.4:** 修改 `use-free-chat-with-machine.ts`
   - 移除轮询代码
   - 使用状态机驱动 UI
   - 测试 Draft→Active 转换

### 阶段 2: 代码清理（中优先级）

5. **步骤 2.1:** 合并 `use-free-chat.ts` 中的 effects
6. **步骤 2.2:** 删除 `use-free-chat-session-query.ts`（已废弃）
7. **步骤 2.3:** 更新 constants.ts 中的错误消息

### 阶段 3: 增强功能（低优先级）

8. **步骤 3.1:** 添加 TanStack Query 集成（可选）
9. **步骤 3.2:** 添加 XState Inspect（开发工具）
10. **步骤 3.3:** 添加单元测试

---

## 六、测试计划

### 测试场景

1. **Draft Session 创建**
   - 选择助手卡片 → 自动创建 Draft
   - Draft 显示在侧边栏（灰色标记）
   - Draft 不调用后端 API

2. **Draft → Active Promotion**
   - 在 Draft 中发送第一条消息
   - 状态机进入 Promoting 状态
   - UI 显示 Loading 指示器
   - 后端创建成功 → Active 状态
   - 侧边栏更新为 Active（绿色标记）
   - 消息保持可见（无刷新）

3. **Promotion 失败回滚**
   - 模拟后端错误（network error）
   - 状态机回滚到 Draft
   - 显示错误提示
   - 用户可以重试

4. **Session 切换**
   - 切换到另一个 Active session
   - 消息正确加载
   - 输入框状态正确

5. **消息持久化**
   - 发送消息后刷新页面
   - 消息保持存在（localStorage）
   - Draft 消息不持久化（正确行为）

---

## 七、风险评估

### 低风险

- ✅ 添加 Immer 中间件（向后兼容）
- ✅ 合并 effects（纯重构）
- ✅ 删除已废弃文件

### 中风险

- ⚠️ 修改 session-machine.ts（需要仔细测试状态转换）
- ⚠️ 移除轮询逻辑（需要验证异步流程）

### 高风险

- ❗ 修改 use-session-machine.ts（核心 Hook，影响所有使用方）
  - **缓解措施:** 分阶段迁移，保留旧版本作为备份

---

## 八、回滚计划

如果重构后出现问题：

1. **立即回滚点：** 
   - Git: `git revert <commit-hash>`
   - 保留旧文件（重命名为 `.legacy.ts`）

2. **功能开关：**
   ```typescript
   const USE_NEW_STATE_MACHINE = process.env.REACT_APP_USE_NEW_MACHINE === 'true';
   
   if (USE_NEW_STATE_MACHINE) {
     // 新实现
   } else {
     // 旧实现（fallback）
   }
   ```

---

## 九、预期收益

### 代码质量

- ✅ 消除双重状态源头
- ✅ 移除轮询反模式
- ✅ 提升可测试性（service 注入）
- ✅ 减少代码行数（Immer 简化）

### 性能

- ✅ 减少不必要的 re-render（合并 effects）
- ✅ 更高效的状态更新（Immer）
- ✅ 减少内存占用（machine 不存储冗余数据）

### 开发体验

- ✅ 更清晰的数据流
- ✅ 更易调试（Redux DevTools + XState Inspect）
- ✅ 更易维护（单一职责原则）

---

## 十、后续优化方向

1. **XState Store 迁移**（长期）
   - 评估 `@xstate/store` 替代 Zustand + XState 组合

2. **TypeScript 严格模式**
   - 启用 `strict: true`
   - 消除所有 `any` 类型

3. **性能监控**
   - 添加 React DevTools Profiler
   - 监控 re-render 次数

4. **文档完善**
   - JSDoc 注释
   - Storybook stories
   - 架构图（Mermaid）

---

## 总结

本重构方案旨在：
1. 消除架构根本问题（双重状态源头、轮询）
2. 遵循官方最佳实践（XState、Zustand、TanStack Query）
3. 提升代码质量和可维护性
4. 降低重构风险（分阶段、可回滚）

**下一步：等待您的确认，然后开始执行重构。**
