# XState Invoke修复 - 最终解决方案
**日期:** 2025-01-11  
**问题:** invoke服务完全未被调用

---

## 根本原因

通过分析浏览器控制台日志，发现：

```
[StateMachine] Entered creatingConversation sub-state
```

但之后**完全没有**：
-  `[StateMachine] Creating invoke input from context:` 
- `[promoteDraftService] INVOKED!`

**关键发现：invoke的input函数根本没有被调用！**

### 为什么会这样？

**原代码（session-machine.ts）：**
```typescript
export const sessionMachine = createMachine({
  // ... states
  invoke: {
    src: 'promoteDraftToActive',  // ❌ 字符串引用
    input: ({ context }) => ({ ... })
  }
}, {
  guards,
  actions,
});
```

**问题：**
- 使用`createMachine()`直接创建，但invoke使用字符串引用`'promoteDraftToActive'`
- XState无法解析这个字符串，因为没有在machine中声明actors
- 字符串引用只在`setup().createMachine()`模式下有效！

**Hook中的注入（use-session-machine.ts）：**
```typescript
const [state, send] = useMachine(sessionMachine, {
  actors: {
    promoteDraftToActive: fromPromise(promoteDraftService),
  },
});
```

**问题：**
- `useMachine`的`actors`选项**只能覆盖已声明的actors**
- 由于machine没有用`setup()`声明actors，XState不知道有这个名字的actor
- 所以注入失败，invoke找不到实现！

---

## 解决方案：使用setup()模式

根据XState v5官方文档，正确的模式是：

### 修复后的代码

**文件：session-machine.ts**

```typescript
import { assign, createMachine, fromPromise, setup } from 'xstate';

export const sessionMachine = setup({
  // ✅ Step 1: 声明类型
  types: {
    context: {} as SessionContext,
    events: {} as SessionEvent,
  },
  
  // ✅ Step 2: 声明actors（关键！）
  actors: {
    promoteDraftToActive: fromPromise<
      PromoteDraftServiceOutput,
      PromoteDraftServiceInput
    >(async () => {
      // 占位实现 - 会在useMachine时被覆盖
      throw new Error('promoteDraftToActive not implemented');
    }),
  },
  
  // ✅ Step 3: 声明guards和actions
  guards,
  actions,
  
}).createMachine({
  // ✅ Step 4: 使用createMachine定义状态
  id: 'freeChatSession',
  initial: 'idle',
  context: { ... },
  states: {
    promoting: {
      states: {
        creatingConversation: {
          invoke: {
            id: 'createConversation',
            src: 'promoteDraftToActive',  // ✅ 现在可以工作了！
            input: ({ context }) => ({
              message: context.pendingMessage,
              dialogId: context.pendingDialogId,
              modelCardId: context.pendingModelCardId,
            }),
            onDone: { target: 'success', actions: ['storeConversationId'] },
            onError: { target: 'failure', actions: ['storePromotionError'] },
          },
        },
      },
    },
  },
});
```

### 为什么这样可以工作？

1. **`setup()`声明了actors**
   - XState知道有一个名为`promoteDraftToActive`的actor
   - 知道它的类型签名（输入`PromoteDraftServiceInput`，输出`PromoteDraftServiceOutput`）

2. **`invoke`可以使用字符串引用**
   - `src: 'promoteDraftToActive'`可以正确解析
   - XState会查找setup中声明的actor

3. **`useMachine`可以覆盖实现**
   - Hook中提供的实际实现会替换占位实现
   - 类型签名必须匹配

---

## 完整流程

### 定义时（session-machine.ts）

```typescript
setup({
  actors: {
    promoteDraftToActive: fromPromise<Output, Input>(placeholderFn)
  }
}).createMachine({
  invoke: { src: 'promoteDraftToActive' }  // ✅ 引用已声明的actor
})
```

### 运行时（use-session-machine.ts）

```typescript
const [state, send] = useMachine(sessionMachine, {
  actors: {
    promoteDraftToActive: fromPromise<Output, Input>(actualImplementation)
    // ✅ 覆盖占位实现
  }
});
```

### 执行时

1. 状态机进入`promoting.creatingConversation`
2. XState查找`src: 'promoteDraftToActive'`
3. 找到setup中声明的actor（已被useMachine覆盖为实际实现）
4. **调用input函数**生成参数
5. **调用actor实现**（promoteDraftService）
6. 根据结果触发`onDone`或`onError`

---

## 预期的新日志输出

修复后，浏览器控制台应该看到：

```
1. [useSessionMachine] Machine created with actors: {hasPromoteDraftService: true}
2. [useSessionMachine] Initializing machine for session: draft_xxx
3. [useSessionMachine] → INIT_DRAFT
4. [StateMachine] Entered DRAFT state

// 用户发送消息
5. [sendMessage] Draft detected, triggering promotion
6. [useSessionMachine] Promoting to active: {sessionId: 'xxx', messageSample: '你好'}
7. [StateMachine] Entered PROMOTING state
8. [StateMachine] PROMOTING context: {pendingMessage: {...}, pendingDialogId: '...', pendingModelCardId: 2}
9. [StateMachine] Entered creatingConversation sub-state

// ✅ 关键：这两行现在应该出现！
10. [StateMachine] Creating invoke input from context: {
      pendingMessage: '你好',
      pendingDialogId: '6736839ca04111f0b54acaa48f96c61c',
      pendingModelCardId: 2,
      inputData: {message: {...}, dialogId: '...', modelCardId: 2}
    }
11. [promoteDraftService] INVOKED! Raw input: {
      message: {content: '你好', role: 'user', ...},
      dialogId: '6736839ca04111f0b54acaa48f96c61c',
      modelCardId: 2
    }

12. [promoteDraftService] START - Creating conversation: {...}
13. [promoteDraftService] Response status: 200
14. [promoteDraftService] SUCCESS - conversation_id: xxx
15. [StateMachine] Entered success sub-state
16. [StateMachine] Entered ACTIVE state
17. [useSessionMachine] Promotion succeeded, updating Zustand: xxx
```

---

## 修改的文件

### 1. session-machine.ts

**主要变更：**
- `createMachine()` → `setup().createMachine()`
- 添加`actors`声明
- 将`guards`和`actions`移入setup

**变更行数：** ~30行

### 2. use-session-machine.ts

**无需修改！** 
- 现有的`useMachine(..., { actors: {...} })`代码已经是正确的
- 它会覆盖setup中的占位实现

---

## XState v5 setup()模式的优势

### 1. **类型安全**
```typescript
setup({
  actors: {
    myActor: fromPromise<Output, Input>(...)
  }
}).createMachine({
  invoke: { src: 'myActor' }  // ✅ TypeScript验证名称正确
})
```

### 2. **可覆盖性**
```typescript
// 定义时：占位实现
setup({ actors: { myActor: placeholder } })

// 使用时：实际实现
useMachine(machine, { actors: { myActor: actual } })
```

### 3. **可测试性**
```typescript
// 测试时：mock实现
const testActor = createActor(machine, {
  actors: { myActor: mockFn }
});
```

### 4. **清晰的契约**
```typescript
setup({
  types: {
    context: {} as MyContext,
    events: {} as MyEvent,
  },
  actors: { /* 所有可用的actors */ },
  guards: { /* 所有可用的guards */ },
  actions: { /* 所有可用的actions */ }
})
```

一眼就能看出这个machine的完整API！

---

## 参考资料

- [XState v5 setup() API](https://stately.ai/docs/xstate/setup)
- [XState v5 Actors](https://stately.ai/docs/xstate/actors)
- [XState v5 Migration Guide](https://stately.ai/docs/xstate/migration)

**关键引用：**
> When using string actor references in `invoke`, you must declare the actor in the `setup()` function. Otherwise, XState won't be able to resolve the actor at runtime.

---

## 验证步骤

1. **刷新页面**
2. **选择助手卡片**（创建draft session）
3. **输入消息并发送**
4. **打开浏览器控制台**
5. **检查是否出现：**
   - `[StateMachine] Creating invoke input from context:`
   - `[promoteDraftService] INVOKED!`

如果这两行出现，说明invoke已经正常工作！🎉

---

**修复完成时间：** 2025-01-11  
**状态：** 已完成，待测试验证
