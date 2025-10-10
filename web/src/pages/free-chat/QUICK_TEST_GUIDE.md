# FreeChat XState 快速测试指南

**最后更新**: 2025-01-11  
**状态**: ✅ 已集成，可测试

---

## 🎯 测试目标

验证Draft→Active转换时，**消息不丢失，界面不刷新**。

---

## ✅ 测试步骤

### 1. 启动开发服务器

```bash
cd web
npm run dev
```

访问: `http://localhost:8000/free-chat?user_id=test_user`

### 2. 基础功能测试

#### Test Case 1: 选择助手创建Draft

1. 点击左侧"助手"标签
2. 选择任意一个助手卡
3. **预期结果**:
   - ✅ 聊天界面切换到该助手
   - ✅ 左侧"话题"标签显示一个草稿对话（虚线边框）
   - ✅ 输入框可用

#### Test Case 2: Draft中输入消息（核心测试！）

1. 确保当前在Draft会话
2. 输入消息："你好"
3. 按Enter发送
4. **预期结果**:
   - ✅ **消息立即显示**在聊天界面（用户头像 + "你好"）
   - ✅ 顶部短暂显示"正在创建对话..."提示
   - ✅ **聊天界面无任何刷新或闪烁**
   - ✅ 左侧Sidebar从"草稿"变为正式对话
   - ✅ AI回复开始流式输出
   - ✅ 全程消息可见，无任何丢失

#### Test Case 3: 继续对话

1. 继续输入第二条消息："讲个笑话"
2. 按Enter发送
3. **预期结果**:
   - ✅ 消息立即显示
   - ✅ 无"正在创建对话..."提示（已是Active）
   - ✅ AI正常回复

#### Test Case 4: 切换助手再创建Draft

1. 点击另一个助手卡
2. **预期结果**:
   - ✅ 切换到该助手的Draft（如果存在）
   - ✅ 或创建新Draft（如果不存在）
   - ✅ 输入框可用

---

## 🔍 关键检查点

### ✅ 消息不丢失

**检查**: Draft发送第一条消息后
- 用户消息立即显示 ✓
- 切换到Active后消息仍然显示 ✓
- 刷新页面后消息存在 ✓

### ✅ 界面不刷新

**检查**: 整个Draft→Active过程中
- 聊天界面无白屏 ✓
- 聊天界面无闪烁 ✓
- 消息列表无重新渲染 ✓
- 只有Sidebar刷新 ✓

### ✅ 状态正确

**检查**: 
- Draft状态显示"草稿"标签 ✓
- Active状态显示正常 ✓
- Promotion时显示"正在创建对话..." ✓

---

## 🐛 常见问题排查

### 问题1: 消息发送后消失

**症状**: 输入消息按Enter后，消息短暂显示然后消失

**原因**: derivedMessages被重新加载

**检查**:
```javascript
// 查看浏览器console
// 应该看到:
[XState] Draft session detected, triggering promotion...
[XState] Promotion completed, conversation_id: xxx

// 不应该看到:
[MessageSync] Loading session: xxx (这表示重新加载了)
```

**解决**: 确认使用了`useFreeChatWithMachine`而不是`useFreeChat`

### 问题2: "正在创建对话..."一直显示

**症状**: Promotion提示一直不消失

**原因**: Promotion失败或超时

**检查**:
```javascript
// 浏览器console查看错误
[XState] Promotion failed: ...
```

**解决**: 
1. 检查网络请求
2. 查看backend日志
3. 确认dialog_id正确

### 问题3: 点击助手卡无反应

**症状**: 点击助手卡后聊天界面不变

**原因**: getOrCreateDraftForCard未正确调用

**检查**:
```javascript
// console应该看到:
[Zustand] Found existing draft for card: xxx
// 或
[Zustand] Creating new draft for card: xxx
```

---

## 📊 性能检查

### 延迟测试

1. 打开Chrome DevTools → Network
2. 限速到"Fast 3G"
3. 发送Draft消息
4. **预期**:
   - 消息立即显示（不受网络影响）
   - "正在创建对话..."显示时间<1s
   - AI回复开始时间<2s

### 内存检查

1. 打开Chrome DevTools → Performance Monitor
2. 连续创建10个Draft
3. 切换20次会话
4. **预期**:
   - JS Heap稳定，无持续增长
   - DOM Nodes稳定

---

## 🎨 UI/UX检查清单

- [ ] Draft会话显示虚线边框 + "草稿"标签
- [ ] Active会话显示正常边框
- [ ] Promoting时顶部显示蓝色提示条
- [ ] 输入框在Promoting时禁用
- [ ] 发送按钮在Promoting时显示loading

---

## 🚀 自动化测试（未来）

```typescript
// 示例：自动化测试草稿
describe('Draft to Active Transition', () => {
  it('should preserve messages during promotion', async () => {
    // 1. 创建Draft
    const draft = createDraft(modelCardId);
    
    // 2. 添加消息
    const message = { content: '你好' };
    addMessage(message);
    
    // 3. 发送消息（触发promotion）
    await sendMessage(message);
    
    // 4. 验证
    expect(derivedMessages).toContain(message);  // 消息仍然存在
    expect(session.state).toBe('active');  // 已转换为Active
    expect(session.conversation_id).toBeDefined();  // 有conversation_id
  });
});
```

---

## 📝 测试报告模板

```markdown
## FreeChat XState 测试报告

**测试日期**: YYYY-MM-DD  
**测试人**: XXX  
**浏览器**: Chrome/Firefox/Safari  

### 测试结果

| 测试项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| Draft创建 | 立即切换 | - | ✅/❌ |
| 消息显示 | 立即可见 | - | ✅/❌ |
| Draft→Active | 无刷新 | - | ✅/❌ |
| AI回复 | 正常流式输出 | - | ✅/❌ |
| Sidebar更新 | Draft→Active | - | ✅/❌ |

### 发现的问题

1. ...
2. ...

### 建议

1. ...
```

---

**测试愉快！** 🎉

如有问题，请查看:
- `SEAMLESS_TRANSITION_IMPLEMENTATION.md` - 实现细节
- `XSTATE_INTEGRATION_GUIDE.md` - XState指南
- Browser Console - 查看详细日志
