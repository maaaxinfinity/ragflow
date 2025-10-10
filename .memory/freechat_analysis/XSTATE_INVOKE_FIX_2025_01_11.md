# XState Invoke Bug修复报告
**日期:** 2025-01-11  
**问题:** Draft对话promotion时invoke服务未被调用

---

## 问题现象

根据用户提供的浏览器控制台日志：

```
[StateMachine] Entered PROMOTING state
[StateMachine] PROMOTING context: {pendingMessage: '你好', pendingDialogId: '...', pendingModelCardId: 2}
[StateMachine] Entered creatingConversation sub-state
```

但之后**没有看到任何**：
- `[StateMachine] Creating invoke input from context:` （invoke的input函数日志）
- `[promoteDraftService] INVOKED!` （service被调用日志）

**关键问题：状态机进入了`promoting.creatingConversation`状态，但invoke配置的service完全没有被触发！**

---

## 根本原因分析

经过对比XState v5官方文档和当前代码，发现以下问题：

### 1. fromPromise类型定义不完整

**现有代码（use-session-machine.ts）：**
```typescript
actors: {
  promoteDraftToActive: fromPromise(promoteDraftService),
}
```

**问题：** 
- XState v5的`fromPromise`需要明确的TypeScript泛型参数
- 没有类型参数可能导致XState内部actor创建失败
- 参考Context7文档，fromPromise应该明确声明输入输出类型

### 2. input函数缺少调试和验证

**现有代码（session-machine.ts）：**
```typescript
input: ({ context }: any) => {
  console.log('[StateMachine] Creating invoke input from context:', { ... });
  return {
    message: context.pendingMessage,
    dialogId: context.pendingDialogId,
    modelCardId: context.pendingModelCardId,
  };
},
```

**问题：**
- 如果context中的字段为`undefined`，返回的对象包含undefined值
- XState可能拒绝调用包含undefined参数的service
- 没有验证逻辑来捕获这种情况

### 3. 缺少详细的状态转换日志

无法确定到底是：
- input函数没有被调用？
- input函数被调用但返回了无效数据？
- service被调用但立即失败？
- actor创建本身失败？

---

## 修复方案

### 修复1：添加fromPromise类型参数

**文件：** `use-session-machine.ts`

```typescript
// ✅ FIX: Proper fromPromise wrapping with explicit typing
actors: {
  promoteDraftToActive: fromPromise<
    { conversationId: string },  // Output type
    { message: any; dialogId: string; modelCardId: number }  // Input type
  >(promoteDraftService),
}
```

**理由：**
- 明确告诉XState这个actor的输入输出契约
- TypeScript编译器可以验证类型正确性
- XState内部可以正确创建typed actor

### 修复2：增强input函数的验证和日志

**文件：** `session-machine.ts`

```typescript
input: ({ context }: any) => {
  const inputData = {
    message: context.pendingMessage,
    dialogId: context.pendingDialogId,
    modelCardId: context.pendingModelCardId,
  };
  
  console.log('[StateMachine] Creating invoke input from context:', {
    pendingMessage: context.pendingMessage?.content?.slice(0, 30),
    pendingDialogId: context.pendingDialogId,
    pendingModelCardId: context.pendingModelCardId,
    inputData,  // ✅ 新增：输出完整的inputData对象
  });
  
  // ✅ 新增：验证所有必需字段
  if (!inputData.message || !inputData.dialogId || !inputData.modelCardId) {
    console.error('[StateMachine] Invalid input data:', inputData);
  }
  
  return inputData;
},
```

**改进：**
- 在返回前验证数据完整性
- 输出完整的`inputData`对象便于调试
- 如果发现undefined立即报错

### 修复3：添加状态变化详细日志

**文件：** `use-session-machine.ts`

```typescript
// 🔧 DEBUG: Log actor state to understand why invoke isn't firing
useEffect(() => {
  console.log('[useSessionMachine] State changed:', {
    value: state.value,
    matches_promoting: state.matches('promoting'),
    matches_creating: state.matches('promoting.creatingConversation'),
    context: state.context,
  });
}, [state.value, state.context]);
```

**作用：**
- 每次状态变化都打印完整的state.value
- 打印state.context，可以看到pending字段是否正确设置
- 帮助定位到底是状态转换失败还是invoke没触发

### 修复4：移除workaround代码

之前的代码包含一个手动调用service的workaround：

```typescript
// 🔧 WORKAROUND: Manually trigger promotion service (bypass XState invoke issue)
useEffect(() => {
  if (isPromotingCreating && pendingMessage && ...) {
    promoteDraftService({ input: { ... }})
      .then(...)
      .catch(...);
  }
}, [state.value, state.context, send, promoteDraftService]);
```

**为什么移除：**
- 这个workaround本身就是反模式
- 如果invoke正常工作，这段代码会导致service被调用两次
- 应该让XState自己管理service生命周期

---

## 验证步骤

修复后，预期的日志输出应该是：

```
1. [useSessionMachine] Machine created with actors: {hasPromoteDraftService: true}
2. [useSessionMachine] Initializing machine for session: draft_xxx
3. [useSessionMachine] → INIT_DRAFT
4. [StateMachine] Entered DRAFT state

// 用户发送消息触发promotion
5. [sendMessage] Draft detected, triggering promotion
6. [useSessionMachine] Promoting to active: {sessionId: 'xxx', messageSample: '你好'}
7. [StateMachine] Entered PROMOTING state
8. [StateMachine] PROMOTING context: {pendingMessage: ..., pendingDialogId: ..., pendingModelCardId: 2}
9. [StateMachine] Entered creatingConversation sub-state

// ✅ 关键：这两行日志应该出现！
10. [StateMachine] Creating invoke input from context: { inputData: {...} }
11. [promoteDraftService] INVOKED! Raw input: { message: ..., dialogId: ..., modelCardId: 2 }

12. [promoteDraftService] START - Creating conversation: {...}
13. [promoteDraftService] Response status: 200
14. [promoteDraftService] Response data: { code: 0, data: { id: 'xxx' } }
15. [promoteDraftService] SUCCESS - conversation_id: xxx

16. [StateMachine] Entered success sub-state
17. [StateMachine] Entered ACTIVE state
18. [useSessionMachine] Promotion succeeded, updating Zustand: xxx
```

### 关键验证点

1. **步骤10应该出现** → 证明invoke的input函数被调用
2. **步骤11应该出现** → 证明promoteDraftService被调用
3. **inputData中所有字段都有值** → 证明context正确传递

---

## 如果问题仍然存在

如果修复后步骤10/11仍然不出现，可能的原因：

### A. XState版本兼容性问题

当前使用：
- `xstate@5.22.1`
- `@xstate/react@6.0.0`

检查：
```bash
cd web
npm list xstate @xstate/react
```

如果版本不匹配，重新安装：
```bash
npm install xstate@latest @xstate/react@latest
```

### B. useMachine初始化时机问题

当前代码在`session`为undefined时也创建machine：

```typescript
const session = useMemo(
  () => getSessionById(sessionId),
  [getSessionById, sessionId],
);

// session可能为undefined
const [state, send] = useMachine(sessionMachine, {
  input: { sessionId },
  actors: { ... }
});
```

**可能问题：** 如果session还没加载，input.sessionId可能无效

**替代方案：** 延迟创建machine
```typescript
if (!session) {
  return { isDraft: true, isPromoting: false, ... }; // 返回默认值
}

const [state, send] = useMachine(...);
```

### C. Context更新时机问题

检查`startPromotion` action是否在invoke之前执行：

```typescript
on: {
  PROMOTE_TO_ACTIVE: {
    target: 'promoting',
    actions: 'startPromotion',  // ✅ 应该先执行action
  },
},

promoting: {
  initial: 'creatingConversation',
  states: {
    creatingConversation: {
      invoke: {  // ✅ 然后才执行invoke
        input: ({ context }) => ({ ... context.pending... })
      }
    }
  }
}
```

**验证：** 在`startPromotion` action中添加日志：
```typescript
startPromotion: assign({
  pendingMessage: ({ event }: any) => {
    console.log('[startPromotion] Storing pendingMessage:', event.message);
    return event.message;
  },
  // ...
}),
```

---

## TypeScript类型修复

顺便修复了lint报告的类型错误：

**文件：** `session-machine.ts`

```typescript
// ❌ Before
export interface SessionTypeState {
  states: {
    idle: {};  // ❌ banned type
    draft: {};
    // ...
  };
}

// ✅ After
export interface SessionTypeState {
  states: {
    idle: Record<string, never>;  // ✅ proper empty object type
    draft: Record<string, never>;
    // ...
  };
}
```

---

## 修改的文件清单

1. `web/src/pages/free-chat/hooks/use-session-machine.ts`
   - 添加fromPromise类型参数
   - 移除workaround代码
   - 添加详细的状态变化日志

2. `web/src/pages/free-chat/machines/session-machine.ts`
   - 增强input函数验证和日志
   - 修复TypeScript类型定义（`{}`→`Record<string, never>`）

---

## 下一步行动

1. **在浏览器中测试**
   - 打开FreeChat页面
   - 选择助手卡片
   - 输入消息并发送
   - 查看浏览器控制台日志

2. **确认关键日志**
   - `[StateMachine] Creating invoke input from context:` 应该出现
   - `[promoteDraftService] INVOKED!` 应该出现
   - 检查inputData是否包含所有必需字段

3. **如果仍然失败**
   - 复制完整的控制台日志
   - 检查是否有XState内部错误
   - 考虑使用XState Inspector工具可视化状态机

---

## 参考资料

- XState v5 Documentation: https://stately.ai/docs/xstate
- XState Invoke Guide: https://stately.ai/docs/xstate/actors#invoke
- Context7 XState Best Practices: 已验证fromPromise用法
- 中文文档: https://lecepin.github.io/xstate-docs-cn/zh/guides/communication.html

---

**修复完成时间：** 2025-01-11  
**状态：** 待测试验证
