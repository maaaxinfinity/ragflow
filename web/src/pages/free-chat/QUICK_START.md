# FreeChat 快速开始测试指南

## 🚀 立即测试

### 方法1: 直接使用当前实现（推荐）

当前代码已经可以直接使用，无需任何修改！

```bash
# 1. 启动开发服务器
cd web
npm run dev
# 或
bun run dev

# 2. 访问
http://localhost:3000/free-chat?user_id=test_user&auth=test_token
```

**预期结果**:
- ✅ 页面正常加载
- ✅ 可以选择助手
- ✅ 可以创建会话
- ✅ 可以发送消息
- ✅ Bug已修复（输入框不会消失）

---

### 方法2: 测试新的Store功能

如果想测试新的Zustand Store功能：

#### Step 1: 在浏览器Console中测试

打开 `/free-chat` 页面，然后在Console中执行：

```javascript
// 查看localStorage中的Store数据
console.log('Session Store:', localStorage.getItem('freechat-session-storage'));
console.log('Message Store:', localStorage.getItem('freechat-message-storage'));

// 直接访问Store (仅在开发环境)
// 注意: 需要先在代码中暴露store到window
```

#### Step 2: 使用Redux DevTools

1. 安装 [Redux DevTools Extension](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd)
2. 打开 `/free-chat` 页面
3. 打开Chrome DevTools → Redux标签
4. 查看 `FreeChat_Session` 和 `FreeChat_Message`

**你可以看到**:
- 完整的状态树
- 所有操作历史
- 时间旅行调试

---

### 方法3: 临时测试导入完整性

在 `index.tsx` 顶部临时添加：

```typescript
// 临时测试 - 测试完成后删除
import { testStoreIntegrity } from './__test_imports__';
```

然后在 `FreeChatContent` 组件中：

```typescript
useEffect(() => {
  // 测试Store完整性
  testStoreIntegrity();
}, []);
```

启动服务器，检查Console输出。

---

## ✅ 功能测试清单

### 核心功能测试（5分钟）

1. **页面加载**
   - [ ] 打开 `/free-chat` 页面
   - [ ] 无控制台错误
   - [ ] 页面正常渲染

2. **选择助手**
   - [ ] 点击左侧"助手"标签
   - [ ] 选择一个Model Card
   - [ ] 自动创建会话
   - [ ] 输入框变为可用

3. **发送消息**
   - [ ] 在输入框输入消息
   - [ ] 按Enter发送
   - [ ] 消息显示在聊天区域
   - [ ] AI回复流式显示

4. **切换会话**
   - [ ] 创建第二个会话
   - [ ] 点击第一个会话
   - [ ] 消息正确切换
   - [ ] 输入框保持可用

5. **刷新页面**
   - [ ] 刷新浏览器
   - [ ] 会话保持（从API加载）
   - [ ] 可以继续使用

### Bug修复验证（2分钟）

1. **输入框不再消失**
   - [ ] 选择助手
   - [ ] 发送第一条消息
   - [ ] ✅ 输入框仍然可用
   - [ ] 发送第二条消息
   - [ ] ✅ 输入框仍然可用

2. **新建会话有model_card_id**
   - [ ] 点击"新建对话"按钮
   - [ ] ✅ 自动使用当前助手或第一个可用助手
   - [ ] ✅ 不会创建无效会话

### Store功能测试（5分钟）

1. **localStorage持久化**
   - [ ] 创建会话并发送消息
   - [ ] 打开DevTools → Application → Local Storage
   - [ ] 查看 `freechat-session-storage`
   - [ ] 查看 `freechat-message-storage`
   - [ ] ✅ 数据已保存

2. **Redux DevTools**
   - [ ] 安装Redux DevTools扩展
   - [ ] 打开DevTools → Redux标签
   - [ ] 查看 `FreeChat_Session`
   - [ ] 执行操作（创建会话、发送消息）
   - [ ] ✅ 操作历史显示
   - [ ] ✅ 状态树更新

---

## 🐛 已知问题

### 当前没有已知阻塞性问题

所有关键Bug已修复：
- ✅ 输入框消失问题 - 已修复
- ✅ model_card_id丢失 - 已修复
- ✅ 消息切换不同步 - Store架构已解决

---

## 📊 测试环境

### 推荐浏览器
- ✅ Chrome 90+ (最佳DevTools支持)
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

### 开发工具
- ✅ Redux DevTools Extension
- ✅ React DevTools Extension

---

## 🔧 问题排查

### 问题1: 页面无法加载

**检查**:
- Console中是否有错误？
- Network中API请求是否成功？
- 是否提供了正确的user_id参数？

**解决**:
```
1. 检查URL: /free-chat?user_id=xxx
2. 检查Console错误信息
3. 检查Network请求状态
```

### 问题2: Store数据为空

**检查**:
```javascript
// Console中执行
localStorage.getItem('freechat-session-storage');
```

**解决**:
- 如果为null: 正常，第一次使用时为空
- 如果有数据: 说明持久化正常工作

### 问题3: Redux DevTools不显示

**检查**:
- 是否安装了扩展？
- 是否在开发环境？
- Store名称是否正确？

**解决**:
```
1. 安装 Redux DevTools Extension
2. 确认 process.env.NODE_ENV === 'development'
3. 刷新页面
```

---

## 📝 测试报告模板

测试完成后，请填写：

```markdown
## 测试报告

**日期**: 2025-01-10
**测试人**: [你的名字]
**浏览器**: Chrome/Firefox/Safari [版本]

### 核心功能
- [ ] 页面加载 - 通过/失败
- [ ] 选择助手 - 通过/失败
- [ ] 发送消息 - 通过/失败
- [ ] 切换会话 - 通过/失败
- [ ] 刷新页面 - 通过/失败

### Bug修复
- [ ] 输入框不消失 - 通过/失败
- [ ] model_card_id正确 - 通过/失败

### Store功能
- [ ] localStorage持久化 - 通过/失败
- [ ] Redux DevTools - 通过/失败

### 发现的问题
[列出任何发现的问题]

### 总体评价
- [ ] ✅ 可以正常使用
- [ ] ⚠️ 有小问题但不影响使用
- [ ] ❌ 有严重问题
```

---

## 🎯 下一步

测试通过后，可以：

1. **开始正常使用** - 当前代码完全可用
2. **查看文档** - 阅读详细文档了解更多
3. **性能优化** - 参考 `PERFORMANCE_OPTIMIZATION.md`
4. **迁移到Enhanced Hook** - 可选，参考 `INTEGRATION_GUIDE.md`

---

## 📚 相关文档

- `CODE_VERIFICATION.md` - 代码完整性验证
- `TESTING_CHECKLIST.md` - 完整测试清单
- `INTEGRATION_GUIDE.md` - 集成指南
- `USAGE_EXAMPLES.md` - 使用示例

---

**现在就可以开始测试了！** 🚀
