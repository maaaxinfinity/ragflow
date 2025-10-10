# XState Invoke修复测试指南
**日期:** 2025-01-11  
**Commit:** 5f174acf

---

## 修复内容总结

### 问题
XState状态机进入`promoting.creatingConversation`状态后，invoke的service完全没有被调用。

### 根本原因
使用`createMachine()`直接创建时，invoke的`src: 'promoteDraftToActive'`字符串引用无法解析，因为XState不知道有这个名字的actor。

### 解决方案
改用`setup().createMachine()`模式，在setup中声明actors：

```typescript
export const sessionMachine = setup({
  actors: {
    promoteDraftToActive: fromPromise<Output, Input>(placeholder)
  },
  guards,
  actions,
}).createMachine({
  invoke: { src: 'promoteDraftToActive' }  // ✅ 现在可以解析
});
```

---

## 测试步骤

### 1. 刷新页面并准备

1. 打开浏览器开发者工具（F12）
2. 切换到 **Console** 标签
3. 刷新页面（Ctrl+R 或 F5）
4. 清空控制台日志（可选）

### 2. 创建Draft Session

1. 在FreeChat页面选择一个助手卡片
2. 系统会创建一个draft session
3. 观察控制台，应该看到：
   ```
   [useSessionMachine] Machine created with actors: {hasPromoteDraftService: true}
   [useSessionMachine] Initializing machine for session: draft_xxx
   [useSessionMachine] → INIT_DRAFT
   [StateMachine] Entered DRAFT state
   ```

### 3. 触发Promotion（关键测试）

1. 在输入框输入消息，例如："你好"
2. 按Enter发送
3. **立即查看控制台日志**

### 4. 预期的日志输出（完整序列）

```javascript
// Step 1: 检测到draft并触发promotion
[sendMessage] Draft detected, triggering promotion (not waiting)

// Step 2: 开始promotion
[useSessionMachine] Promoting to active: {
  sessionId: 'draft_2_xxx',
  messageSample: '你好'
}

// Step 3: 进入PROMOTING状态
[StateMachine] Entered PROMOTING state
[StateMachine] PROMOTING context: {
  pendingMessage: '你好',
  pendingDialogId: '6736839ca04111f0b54acaa48f96c61c',
  pendingModelCardId: 2
}

// Step 4: 进入creatingConversation子状态
[StateMachine] Entered creatingConversation sub-state

// ✅ Step 5: 关键 - invoke的input函数被调用
[StateMachine] Creating invoke input from context: {
  pendingMessage: '你好',
  pendingDialogId: '6736839ca04111f0b54acaa48f96c61c',
  pendingModelCardId: 2,
  inputData: {
    message: {content: '你好', role: 'user', ...},
    dialogId: '6736839ca04111f0b54acaa48f96c61c',
    modelCardId: 2
  }
}

// ✅ Step 6: 关键 - service被调用
[promoteDraftService] INVOKED! Raw input: {
  message: {content: '你好', role: 'user', ...},
  dialogId: '6736839ca04111f0b54acaa48f96c61c',
  modelCardId: 2
}

// Step 7: Service开始执行
[promoteDraftService] START - Creating conversation: {
  dialogId: '6736839ca04111f0b54acaa48f96c61c',
  modelCardId: 2,
  messageSample: '你好'
}

// Step 8: API响应
[promoteDraftService] Response status: 200
[promoteDraftService] Response data: {
  code: 0,
  data: {id: 'conversation_xxx'}
}

// Step 9: Success
[promoteDraftService] SUCCESS - conversation_id: conversation_xxx

// Step 10: 转换到ACTIVE状态
[StateMachine] Entered ACTIVE state
[useSessionMachine] Promotion succeeded, updating Zustand: conversation_xxx
```

---

## 验证检查点

### ✅ 成功标志

如果看到以下**两行关键日志**，说明修复成功：

1. **`[StateMachine] Creating invoke input from context:`**
   - 证明：invoke的input函数被调用
   - 位置：应该在`Entered creatingConversation sub-state`之后

2. **`[promoteDraftService] INVOKED! Raw input:`**
   - 证明：service函数被调用
   - 位置：应该在input日志之后

### ❌ 失败标志

如果**没有**看到上述两行日志，说明invoke仍然有问题。

**旧版本的日志（修复前）：**
```
[StateMachine] Entered creatingConversation sub-state
// ❌ 然后就没有了！
```

---

## 故障排查

### 问题1：仍然看不到invoke日志

**可能原因：**
- 代码没有热更新，需要硬刷新
- 浏览器缓存了旧代码

**解决方案：**
```bash
# 1. 强制刷新浏览器
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# 2. 清除浏览器缓存
# 或者打开隐身窗口测试

# 3. 检查前端dev server是否重启
cd web
npm run dev
```

### 问题2：看到input日志但没有INVOKED日志

**可能原因：**
- input返回的数据包含undefined
- fromPromise类型不匹配

**解决方案：**
查看input日志中的`inputData`对象，确认所有字段都有值：
```javascript
inputData: {
  message: {...},        // ✅ 应该是对象，不是undefined
  dialogId: '...',       // ✅ 应该是字符串
  modelCardId: 2         // ✅ 应该是数字
}
```

如果有undefined，会看到：
```
[StateMachine] Invalid input data: {message: undefined, ...}
```

### 问题3：INVOKED后立即失败

**可能原因：**
- API endpoint错误
- 认证token过期

**解决方案：**
查看后续的错误日志：
```javascript
[promoteDraftService] ERROR: Error: ...
[StateMachine] Promotion failed: Error: ...
```

---

## 性能测试

### 测试场景1：正常流程
1. 选择助手 → 输入消息 → 发送
2. 记录从`PROMOTING`到`ACTIVE`的时间
3. **预期：< 1秒**（取决于网络）

### 测试场景2：快速连续发送
1. 选择助手 → 输入消息1 → 发送
2. 立即输入消息2 → 尝试发送
3. **预期：第二条消息应该被阻止**（isPromoting=true）

### 测试场景3：Promotion失败重试
1. 断开网络 → 选择助手 → 发送消息
2. Promotion应该失败
3. 100ms后自动回滚到draft
4. 恢复网络 → 重新发送消息
5. **预期：第二次应该成功**

---

## 成功标准

修复被认为成功，当且仅当：

1. ✅ 每次draft promotion都能看到invoke日志
2. ✅ Promotion成功后状态变为ACTIVE
3. ✅ conversation_id被正确保存到Zustand
4. ✅ 用户可以继续发送后续消息
5. ✅ 没有控制台错误或警告

---

## 回归测试

确保以下场景仍然正常工作：

### 场景A：已存在的Active Session
1. 刷新页面
2. 点击sidebar中已有的对话
3. **预期：直接加载对话历史，无promotion**

### 场景B：删除Session
1. 创建draft → 发送消息 → promotion成功
2. 删除这个session
3. **预期：session被删除，状态变为DELETED**

### 场景C：切换Session
1. 创建多个draft sessions
2. 在它们之间切换
3. **预期：每个session的状态独立管理**

---

## 浏览器兼容性测试

在以下浏览器中测试：
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (如果有Mac)

---

## 报告问题

如果测试失败，请收集以下信息：

1. **完整的控制台日志**（从页面加载到错误发生）
2. **浏览器版本**（chrome://version）
3. **复现步骤**（详细）
4. **预期行为 vs 实际行为**

将这些信息附加到测试报告中。

---

## 下一步

测试通过后：
1. 更新`FINAL_IMPLEMENTATION_SUMMARY_2025_01_11.md`标记为已验证
2. 考虑移除所有debug日志（可选）
3. 添加XState Inspector集成（可选，用于可视化状态机）

---

**测试指南版本:** 1.0  
**最后更新:** 2025-01-11  
**状态:** 待执行
