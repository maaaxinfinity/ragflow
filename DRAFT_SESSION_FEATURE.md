# 临时新对话（Draft Session）功能实现

## 🎯 需求说明

**问题**：
- 用户点击模型卡或"新建对话"按钮时，立即创建并保存"新对话"session
- 即使用户没有发送任何消息，这个空session也会保存到settings
- 刷新页面后，会话列表中出现大量空的"新对话"
- 用户体验差，session列表混乱

**解决方案**：
- 引入"临时会话"（Draft Session）机制
- 点击模型卡/新建对话时，创建**不保存**的临时session
- 临时session在会话列表中**不显示**（除非是当前激活的）
- 切换到其他session时，临时session**自动删除**
- 只有当用户**发送第一条消息**时，才转为持久化session

---

## 📋 实现概览

### 1. 数据结构变更

**IFreeChatSession接口**（`use-free-chat-session.ts`）：

```typescript
export interface IFreeChatSession {
  id: string;
  conversation_id?: string;
  model_card_id?: number;
  name: string;
  created_at: number;
  updated_at: number;
  message_count?: number;
  isDraft?: boolean;  // ✅ NEW: 标记临时会话
  params?: {
    temperature?: number;
    top_p?: number;
    role_prompt?: string;
  };
}
```

### 2. 核心机制

#### 机制A：Draft session不保存到settings

**saveSessions()函数**：

```typescript
const saveSessions = useCallback(
  (newSessions: IFreeChatSession[]) => {
    // 只保存非draft的session
    const persistentSessions = newSessions.filter(s => !s.isDraft);
    console.log('[useFreeChatSession] Saving sessions - total:', newSessions.length, 'persistent:', persistentSessions.length);
    onSessionsChange?.(persistentSessions);
  },
  [onSessionsChange],
);
```

**效果**：
- Draft session存在于内存中（可以使用）
- 但不会保存到settings（刷新后消失）

---

#### 机制B：创建新session时自动清理旧draft

**createSession()函数**：

```typescript
const createSession = useCallback((name?: string, model_card_id?: number, isDraft: boolean = false) => {
  let newSession: IFreeChatSession;

  setSessions(prevSessions => {
    // 如果创建draft，先清理已有的draft
    const filteredSessions = isDraft 
      ? prevSessions.filter(s => !s.isDraft)
      : prevSessions;

    newSession = {
      id: uuid(),
      name: name || '新对话',
      model_card_id,
      created_at: Date.now(),
      updated_at: Date.now(),
      isDraft,  // 标记为draft
    };
    
    const updatedSessions = [newSession, ...filteredSessions];
    saveSessions(updatedSessions);  // 自动过滤draft
    return updatedSessions;
  });

  setCurrentSessionId(newSession!.id);
  return newSession!;
}, [saveSessions]);
```

**效果**：
- 同一时间只能有一个draft session
- 创建新draft时，旧的自动清理

---

#### 机制C：切换session时自动清理draft

**switchSession()函数**：

```typescript
const switchSession = useCallback((sessionId: string) => {
  setSessions(prevSessions => {
    const targetSession = prevSessions.find(s => s.id === sessionId);
    if (targetSession) {
      // 清理所有draft（除了目标session）
      const cleanedSessions = prevSessions.filter(s => 
        !s.isDraft || s.id === sessionId
      );
      
      setCurrentSessionId(sessionId);
      
      if (cleanedSessions.length !== prevSessions.length) {
        console.log('[useFreeChatSession] Cleaned up', prevSessions.length - cleanedSessions.length, 'draft sessions');
        saveSessions(cleanedSessions);
        return cleanedSessions;
      }
      return prevSessions;
    }
    return prevSessions;
  });
}, [saveSessions]);
```

**效果**：
- 用户切换到其他会话时，临时draft自动消失
- 除非切换到的就是draft本身

---

#### 机制D：首次发送消息时转为持久化

**sendMessage()函数**（`use-free-chat.ts`）：

```typescript
const sendMessage = useCallback(
  async (message: Message, customParams?: DynamicModelParams) => {
    setIsSending(true);
    
    try {
      if (!dialogId) {
        logError(t('noDialogIdError'), ...);
        return;
      }

      // CRITICAL: 转换draft为persistent
      if (currentSession?.isDraft) {
        console.log('[useFreeChat] Converting draft session to persistent:', currentSession.id);
        updateSession(currentSession.id, { isDraft: undefined });
      }

      let conversationId = currentSession?.conversation_id;
      // ... 继续发送逻辑
```

**效果**：
- 用户发送第一条消息时，移除isDraft标记
- session自动变为持久化，下次saveSessions时会保存

---

#### 机制E：Sidebar过滤draft显示

**sidebar-dual-tabs.tsx**：

```typescript
filteredSessions
  // 过滤draft（除非是当前激活的）
  .filter(session => !session.isDraft || session.id === currentSessionId)
  .map((session) => {
    // ... 渲染session项
```

**效果**：
- Draft session不在列表中显示
- 除非它是当前激活的（用户正在使用）
- 这样用户不会看到"新对话"堆积

---

### 3. 触发点修改

#### A. 点击模型卡

**handleModelCardChange()函数**（`index.tsx`）：

```typescript
const handleModelCardChange = useCallback(
  (newModelCardId: number) => {
    // 创建DRAFT session
    createSession('新对话', newModelCardId, true);  // isDraft=true
  },
  [createSession],
);
```

#### B. 点击"新建对话"按钮

**handleNewSession()函数**（`index.tsx`）：

```typescript
const handleNewSession = useCallback(() => {
  // 创建DRAFT session
  createSession(undefined, currentSession?.model_card_id, true);  // isDraft=true
}, [createSession, currentSession?.model_card_id]);
```

---

## 📊 完整生命周期

### 场景1：点击模型卡 → 不发消息 → 切换其他session

```
1. 用户点击"专业律师助理"模型卡
   ↓
2. handleModelCardChange(1)
   ↓
3. createSession('新对话', 1, true)
   ↓
4. 创建draft session {id: 'xxx', isDraft: true, model_card_id: 1}
   ↓
5. Draft存在于内存，但不保存到settings
   ↓
6. Sidebar不显示这个draft（列表仍为空或显示其他session）
   ↓
7. 用户点击另一个session
   ↓
8. switchSession() 自动清理draft
   ↓
9. Draft session被删除（未保存任何数据）
```

**结果**：
- ✅ Settings中无空"新对话"
- ✅ 会话列表干净
- ✅ 刷新页面后，无痕迹

---

### 场景2：点击模型卡 → 发送消息 → 刷新页面

```
1. 用户点击"专业律师助理"模型卡
   ↓
2. createSession('新对话', 1, true)
   ↓
3. Draft session创建 {id: 'xxx', isDraft: true}
   ↓
4. 用户输入"你好"并发送
   ↓
5. sendMessage() 检测到 currentSession.isDraft === true
   ↓
6. updateSession(xxx, {isDraft: undefined})
   ↓
7. Draft转为persistent session
   ↓
8. 创建conversation，发送消息
   ↓
9. updateSession(xxx, {conversation_id: 'conv-123', name: '你好'})
   ↓
10. saveSessions() 被调用
    ↓
11. Session已无isDraft标记 → 保存到settings
    ↓
12. POST /v1/free_chat/settings（包含这个session）
    ↓
13. 用户刷新页面
    ↓
14. GET /v1/free_chat/settings → session仍在列表中
```

**结果**：
- ✅ 只有真正对话的session被保存
- ✅ 刷新后会话保留
- ✅ Session名称自动设为第一条消息内容

---

### 场景3：点击"新建对话" → 切换tab → 返回

```
1. 用户点击左上角"新建对话"按钮
   ↓
2. handleNewSession()
   ↓
3. createSession(undefined, currentModel, true)
   ↓
4. Draft session创建，用户看到输入框（但列表无变化）
   ↓
5. 用户切换到浏览器其他tab
   ↓
6. （Draft仍在内存中）
   ↓
7. 用户返回，点击另一个已存在的会话
   ↓
8. switchSession() 自动清理draft
   ↓
9. Draft消失，无痕迹
```

---

## 🔍 调试日志

启用了详细的console.log，方便调试：

```
[useFreeChatSession] Created session: xxx-xxx-xxx isDraft: true
[useFreeChatSession] Saving sessions - total: 5 persistent: 4
[useFreeChat] Converting draft session to persistent: xxx-xxx-xxx
[useFreeChatSession] Switched to session: yyy-yyy-yyy isDraft: false
[useFreeChatSession] Cleaned up 1 draft sessions
[useFreeChatSession] Deleted session: xxx-xxx-xxx
```

---

## ✅ 修改文件清单

### 前端文件

1. **`web/src/pages/free-chat/hooks/use-free-chat-session.ts`**
   - 添加`isDraft`字段到接口
   - 修改`saveSessions`过滤draft
   - 修改`createSession`支持isDraft参数
   - 修改`switchSession`自动清理draft
   - 修改`deleteSession`支持skipSave选项

2. **`web/src/pages/free-chat/hooks/use-free-chat.ts`**
   - 修改`sendMessage`在首次发送时转换draft

3. **`web/src/pages/free-chat/index.tsx`**
   - 修改`handleModelCardChange`创建draft
   - 修改`handleNewSession`创建draft

4. **`web/src/pages/free-chat/components/sidebar-dual-tabs.tsx`**
   - 过滤draft session显示

### 后端文件

**无需修改**！Draft机制完全在前端实现。

---

## 🎯 功能验证

### 测试1：Draft不保存

1. 打开FreeChat
2. 点击一个模型卡
3. 不发送消息
4. 刷新页面
5. **预期**：新对话消失，会话列表无变化

### 测试2：Draft转持久化

1. 打开FreeChat
2. 点击模型卡
3. 发送消息"测试"
4. 刷新页面
5. **预期**：会话保留，名称为"测试"

### 测试3：切换清理

1. 打开FreeChat
2. 点击"新建对话"
3. 不发送消息
4. 点击另一个已存在的会话
5. **预期**：Draft自动消失，无痕迹

### 测试4：Sidebar不显示

1. 打开FreeChat
2. 点击模型卡
3. 观察左侧会话列表
4. **预期**：列表中不出现"新对话"（但输入框可用）

---

## 🚀 部署步骤

### 前端构建

```bash
cd web
npm run build
```

### 验证

1. 清除浏览器缓存（Ctrl+Shift+Delete）
2. 硬性刷新（Ctrl+Shift+R）
3. 执行上述测试用例

---

## 📝 用户体验改进

### 修复前：

- ❌ 点击模型卡立即创建"新对话"并保存
- ❌ 会话列表混乱，大量空对话
- ❌ 刷新后看到堆积的"新对话"
- ❌ 用户需要手动删除

### 修复后：

- ✅ 点击模型卡创建临时对话
- ✅ 不发消息不保存，自动清理
- ✅ 会话列表干净，只显示真实对话
- ✅ 刷新页面无痕迹
- ✅ 发送消息才持久化

---

**实现完成时间**: 2025年1月  
**功能状态**: ✅ 代码完成，待测试验证  
**影响范围**: FreeChat用户体验，无破坏性变更  
**兼容性**: 向下兼容，现有session不受影响
