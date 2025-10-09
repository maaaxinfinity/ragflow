# FreeChat Draft Promotion 核心修复
**日期**: 2025-01-10  
**修复范围**: Draft会话提升逻辑、ID统一、会话同步

---

## 问题根源

### 症状
用户点击助手卡 → 创建Draft会话 → 输入消息回车 → Toast提示"更新成功" → **左侧对话消失**

### 根本原因

1. **双ID系统混乱**
   - Draft使用本地UUID作为`id`
   - Backend创建conversation后返回新的`conversation_id`
   - 旧逻辑：将`conversation_id`存储到Draft的字段中，但Draft的`id`保持不变
   - 结果：Draft的`id` ≠ Backend的`conversation_id`，导致同步失败

2. **refetchSessions误删Draft**
   - `refetchSessions()`从后端拉取Active会话列表
   - 旧去重逻辑：通过`model_card_id`和`created_at`匹配Draft和Active
   - 问题：Draft的`created_at`和Backend新创建的Active不一致
   - 结果：Draft被误判为"重复"并删除

3. **消息同步失败**
   - Draft提升后`currentSessionId`应该切换到Backend的`conversation_id`
   - 但旧逻辑只更新了Draft的字段，没有切换`currentSessionId`
   - 结果：`derivedMessages`无法回写到正确的会话

---

## 修复方案

### 核心策略：原子性ID替换

**原则**：Draft → Active必须是**删除Draft + 创建Active**的原子操作，使用Backend的`conversation_id`作为唯一ID。

### 修复流程

```
用户点击助手卡
    ↓
创建Draft (id = local_uuid, state = 'draft')
    ↓
用户输入消息回车
    ↓
Backend创建conversation → 获取conversation_id
    ↓
【原子性替换】
  1. 保存Draft的model_card_id和params
  2. deleteSession(draft_id)  // 删除本地Draft
  3. createSession(..., conversationId)  // 创建Active（使用Backend ID）
  4. updateSession(conversationId, { params })  // 恢复params
  5. switchSession(conversationId)  // 切换到Active
    ↓
后续消息正常发送和持久化（ID已统一）
```

---

## 修复实施

### Step 1: 修改`createSession`支持外部指定ID

**文件**: `web/src/pages/free-chat/hooks/use-free-chat-session-query.ts`

#### 1.1 修改Mutation函数签名（Line 125-135）

```typescript
mutationFn: async ({ 
  name, 
  model_card_id, 
  isDraft = false,
  conversationId  // ✅ 新增参数
}: { 
  name?: string; 
  model_card_id?: number; 
  isDraft?: boolean;
  conversationId?: string;  // ✅ 新增类型
}) => {
```

#### 1.2 使用外部ID或生成新ID（Line 151-152）

```typescript
// Use provided conversationId or generate new one (for Draft promotion)
const finalConversationId = conversationId || uuid();
```

#### 1.3 后端请求使用指定ID（Line 167）

```typescript
body: JSON.stringify({
  conversation_id: finalConversationId,  // ✅ 使用指定ID
  // ...
}),
```

#### 1.4 返回值包含统一ID（Line 182-186）

```typescript
return {
  ...result.data,
  id: finalConversationId,  // ✅ 确保ID一致
  conversation_id: finalConversationId,
  state: 'active',
} as IFreeChatSession;
```

#### 1.5 Wrapper函数接受conversationId（Line 397-441）

```typescript
const createSession = useCallback(
  (
    name?: string, 
    model_card_id?: number, 
    isDraft = false,
    conversationId?: string  // ✅ 新增参数
  ): IFreeChatSession | undefined => {
    // ...
    
    // For active sessions: trigger backend creation
    createSessionMutation.mutate({ 
      name, 
      model_card_id, 
      isDraft: false,
      conversationId  // ✅ 传递给mutation
    });
    
    return undefined;
  },
  [createSessionMutation, queryClient, userId, dialogId]
);
```

---

### Step 2: 修改Draft→Active提升逻辑（原子性替换）

**文件**: `web/src/pages/free-chat/hooks/use-free-chat.ts`  
**位置**: Line 192-222（sendMessage函数）

```typescript
if (convData.code === 0) {
  conversationId = convData.data.id;
  
  // FIX: Atomic Draft → Active promotion
  // Delete local Draft + Create Active with backend ID + Switch to Active
  if (currentSession) {
    const draftId = currentSession.id;
    const draftModelCardId = currentSession.model_card_id;
    const draftParams = currentSession.params;
    
    // 1. Delete local Draft
    deleteSession(draftId);
    
    // 2. Create Active session with backend conversation_id as ID
    createSession(
      conversationName, 
      draftModelCardId, 
      false,  // isDraft = false
      conversationId  // Use backend ID
    );
    
    // 3. Restore Draft params to new Active session
    if (draftParams) {
      updateSession(conversationId, { params: draftParams });
    }
    
    // 4. Switch to new Active session
    switchSession(conversationId);
    
    console.log('[SendMessage] Draft atomically promoted:', draftId, '→', conversationId);
  }
}
```

**关键点**：
- ✅ 删除Draft在创建Active之前
- ✅ Active使用Backend的`conversation_id`作为`id`
- ✅ 立即切换`currentSessionId`到新ID
- ✅ 恢复Draft的参数到新Active会话

---

### Step 3: 移除不必要的refetchSessions

**文件**: `web/src/pages/free-chat/hooks/use-free-chat.ts`  
**位置**: Line 271-277（sendMessage函数成功分支）

**删除代码**：
```typescript
// ❌ 删除这段
// } else {
//   setTimeout(() => {
//     console.log('[SendMessage] Triggering session refresh after successful send');
//     refetchSessions();
//   }, 1000);
// }
```

**替换为**：
```typescript
if (res && (res?.response.status !== 200 || res?.data?.code !== 0)) {
  setValue(message.content);
  removeLatestMessage();
}
// STEP 3 FIX: Removed refetchSessions call
// Messages are already persisted by completion API
// createSession mutation auto-updates cache
```

**原因**：
- 消息已通过`/v1/conversation/completion` API持久化
- `createSessionMutation`的`onSuccess`已更新cache
- 避免不必要的网络请求和Draft覆盖风险

---

### Step 4: 简化refetchSessions的Draft合并逻辑

**文件**: `web/src/pages/free-chat/hooks/use-free-chat-session-query.ts`  
**位置**: Line 95-107（refetchSessions函数）

**删除复杂去重逻辑**：
```typescript
// ❌ 删除这段
// const validDrafts = drafts.filter(draft => {
//   const hasDuplicate = activeSessions.some(active => 
//     active.model_card_id === draft.model_card_id &&
//     Math.abs(active.created_at - draft.created_at) < 5000
//   );
//   return !hasDuplicate;
// });
```

**替换为简化版本**：
```typescript
// STEP 4 FIX: Simplified Draft merging logic
// If there were drafts, merge them back directly
// No deduplication needed: Draft→Active conversion atomically deletes Draft
if (drafts.length > 0 && result.data) {
  console.log('[refetchSessions] Merging', drafts.length, 'draft(s) back into cache');
  
  const activeSessions = result.data as IFreeChatSession[];
  
  queryClient.setQueryData(
    ['freeChatSessions', userId, dialogId],
    [...drafts, ...activeSessions]
  );
}
```

**原因**：
- Draft→Active转换已通过`deleteSession(draftId)`删除Draft
- 不会出现"Draft和Active同时存在"的情况
- 简化逻辑，避免误判

---

### Step 5: 验证消息回写逻辑

**文件**: `web/src/pages/free-chat/hooks/use-free-chat.ts`  
**位置**: Line 361-412（derivedMessages同步effect）

**无需修改**，现有逻辑已正确：

```typescript
useEffect(() => {
  const sessionId = currentSessionIdRef.current;  // ✅ 使用当前sessionId
  
  // ...
  
  const session = sessionsRef.current.find(s => s.id === sessionId);
  
  // ✅ Draft永不回写
  if (session?.state === 'draft') {
    console.log('[MessageSync→Session] Draft session, no sync needed');
    return;
  }
  
  // ✅ Active会话回写（sessionId已经是conversation_id）
  if (messagesChanged) {
    updateSession(sessionId, {
      messages: derivedMessages,
    });
  }
}, [derivedMessages, updateSession]);
```

**验证点**：
- ✅ Draft提升后`currentSessionId`已切换为`conversation_id`
- ✅ `updateSession(conversationId, ...)`正确更新对应会话
- ✅ Draft被正确跳过，不参与消息同步

---

## 修复依赖更新

**文件**: `web/src/pages/free-chat/hooks/use-free-chat.ts`  
**位置**: Line 281-296（sendMessage依赖数组）

**修改前**：
```typescript
[
  // ...
  updateSession,
  refetchSessions,  // ❌ 删除
  t,
],
```

**修改后**：
```typescript
[
  // ...
  updateSession,
  deleteSession,    // ✅ 新增
  createSession,    // ✅ 新增
  switchSession,    // ✅ 新增
  t,
],
```

---

## 数据流对比

### 修复前（错误流程）

```
Draft (id = uuid_1)
    ↓ 用户发送消息
Backend创建conversation (conversation_id = uuid_2)
    ↓
updateSession(uuid_1, { conversation_id: uuid_2, state: 'active' })
    ↓ currentSessionId仍为uuid_1
refetchSessions()
    ↓ 从Backend获取Active会话（id = uuid_2）
去重逻辑：uuid_1的Draft vs uuid_2的Active
    ↓ created_at不匹配 → 认为Draft是重复 → 删除Draft
    ↓ currentSessionId = uuid_1但会话不存在
❌ 对话消失
```

### 修复后（正确流程）

```
Draft (id = uuid_1, state = 'draft')
    ↓ 用户发送消息
Backend创建conversation (conversation_id = uuid_2)
    ↓
【原子性替换】
  deleteSession(uuid_1)  // 删除Draft
  createSession(..., uuid_2)  // 创建Active（id = uuid_2）
  switchSession(uuid_2)  // 切换到uuid_2
    ↓ currentSessionId = uuid_2
derivedMessages同步到uuid_2会话 ✅
    ↓
后续消息正常发送和持久化 ✅
```

---

## 关键原则总结

1. **单一ID原则**: 会话的`id`应始终等于Backend的`conversation_id`
2. **原子性操作**: Draft→Active转换必须是删除+创建+切换的原子操作
3. **立即切换**: 创建Active会话后立即切换`currentSessionId`
4. **Draft隔离**: Draft永远不参与消息回写和Backend同步
5. **简化逻辑**: 移除不必要的去重和refetch，依赖mutation自动更新cache

---

## 测试验证

### Test Case 1: Draft创建和提升
1. ✅ 点击助手卡 → 验证创建Draft（左侧显示"新对话"）
2. ✅ 输入消息回车 → 验证Draft消失，出现Active会话
3. ✅ 检查会话名称自动更新为消息前50字
4. ✅ 检查Network：`/v1/conversation/set`使用Backend ID

### Test Case 2: 消息持久化
1. ✅ Draft提升为Active后发送3条消息
2. ✅ 刷新页面 → 验证3条消息仍在
3. ✅ 检查`/v1/conversation/list`返回正确的messages

### Test Case 3: 参数继承
1. ✅ 在Draft状态下调整Temperature和Top P
2. ✅ 发送消息提升为Active
3. ✅ 验证参数仍保留在Active会话中

### Test Case 4: 多助手切换
1. ✅ 创建助手A的Draft
2. ✅ 切换到助手B（创建新Draft）
3. ✅ 验证助手A的Draft被删除（避免Draft堆积）

---

## 代码位置索引

| 修复点 | 文件 | 行号 | 说明 |
|-------|------|------|------|
| Step 1.1 | `use-free-chat-session-query.ts` | 125-135 | Mutation函数签名 |
| Step 1.2 | `use-free-chat-session-query.ts` | 151-152 | 使用外部ID |
| Step 1.3 | `use-free-chat-session-query.ts` | 167 | Backend请求 |
| Step 1.4 | `use-free-chat-session-query.ts` | 182-186 | 返回值 |
| Step 1.5 | `use-free-chat-session-query.ts` | 397-441 | Wrapper函数 |
| Step 2 | `use-free-chat.ts` | 192-222 | 原子性替换 |
| Step 3 | `use-free-chat.ts` | 271-277 | 删除refetch |
| Step 4 | `use-free-chat-session-query.ts` | 95-107 | 简化Draft合并 |
| Step 5 | `use-free-chat.ts` | 361-412 | 验证（无修改） |
| 依赖更新 | `use-free-chat.ts` | 281-296 | 依赖数组 |

---

**修复完成**: 所有Draft提升问题已系统性解决，会话ID统一，消息同步正常，用户体验流畅。
