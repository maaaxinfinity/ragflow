# 08 - 前端核心业务Hook详解

**模块**: `web/src/pages/free-chat/hooks/`  
**功能**: FreeChat核心业务逻辑封装  
**Hooks数量**: 8个自定义Hooks

---

## 📋 目录

1. [use-free-chat.ts - 主业务逻辑](#use-free-chat-主业务逻辑)
2. [use-free-chat-session.ts - 会话管理](#use-free-chat-session-会话管理)
3. [use-free-chat-settings-api.ts - 设置同步](#use-free-chat-settings-api-设置同步)
4. [Hook协作关系](#hook协作关系)
5. [消息发送完整流程](#消息发送完整流程)

---

## use-free-chat 主业务逻辑

### 文件信息
- **路径**: `use-free-chat.ts`
- **行数**: 375行
- **职责**: 对话核心业务逻辑编排

### Hook签名

```typescript
export const useFreeChat = (
  controller: AbortController,        // SSE请求控制器
  userId?: string,                    // 外部用户ID
  settings?: FreeChatSettings,        // 用户设置
  onSessionsChange?: (sessions: any[]) => void  // 会话变更回调
)
```

### 核心状态管理

```typescript
// 1. Dialog ID状态
const [dialogId, setDialogId] = useState<string>(settings?.dialog_id || '');

// 2. 消息相关状态
const { 
  derivedMessages,         // 当前会话消息列表
  setDerivedMessages,      // 设置消息列表
  addNewestAnswer,         // 添加AI回答
  addNewestQuestion,       // 添加用户问题
  removeLatestMessage,     // 删除最新消息
  removeMessageById,       // 按ID删除消息
  removeAllMessages        // 清空消息
} = useSelectDerivedMessages();

// 3. SSE流式响应
const { send, answer, done } = useSendMessageWithSse(api.completeConversation);

// 4. 会话管理
const {
  currentSession,          // 当前会话对象
  currentSessionId,        // 当前会话ID
  createSession,           // 创建新会话
  updateSession,           // 更新会话
  sessions,                // 所有会话列表
  switchSession,           // 切换会话
  deleteSession,           // 删除会话
  clearAllSessions         // 清空所有会话
} = useFreeChatSession({
  initialSessions: settings?.sessions,
  onSessionsChange,
});

// 5. 知识库选择
const { enabledKBs } = useKBContext();  // 当前启用的知识库Set
```

### sendMessage() 核心函数

这是整个FreeChat最核心的函数，负责发送消息并处理响应。

```typescript
const sendMessage = useCallback(
  async (message: Message, customParams?: DynamicModelParams) => {
    // ========== 步骤1: 验证dialogId ==========
    if (!dialogId) {
      logError(
        t('noDialogIdError'),
        'useFreeChat.sendMessage',
        true,
        t('noDialogIdError')
      );
      return;
    }

    let conversationId = currentSession?.conversation_id;

    // ========== 步骤2: 创建conversation（如果不存在）==========
    if (!conversationId) {
      // 验证model_card_id必须存在
      if (!currentSession?.model_card_id) {
        logError(
          'model_card_id is required',
          'useFreeChat.sendMessage',
          true,
          'Please select a model card first'
        );
        removeLatestMessage();
        return;
      }

      // 确定conversation名称
      const conversationName = currentSession.name && currentSession.name !== '新对话'
        ? currentSession.name
        : message.content.slice(0, 50);

      // 调用后端API创建conversation
      const convData = await updateConversation({
        dialog_id: dialogId,
        name: conversationName,
        is_new: true,
        model_card_id: currentSession.model_card_id,
        message: [
          {
            role: MessageType.Assistant,
            content: '',
          },
        ],
      });

      if (convData.code === 0) {
        conversationId = convData.data.id;
        // 更新会话的conversation_id
        updateSession(currentSession.id, { conversation_id: conversationId });
      } else {
        logError(
          t('failedToCreateConversation'),
          'useFreeChat.sendMessage',
          true,
          t('failedToCreateConversation')
        );
        removeLatestMessage();
        return;
      }
    }

    // ========== 步骤3: 再次验证model_card_id ==========
    if (!currentSession?.model_card_id) {
      logError(
        'model_card_id is required',
        'useFreeChat.sendMessage',
        true,
        'Please select a model card first'
      );
      removeLatestMessage();
      return;
    }

    // ========== 步骤4: 构建请求参数 ==========
    // 合并参数：customParams 或 session.params
    const baseParams = customParams || currentSession.params || {};
    const kbIdsArray = Array.from(enabledKBs);

    const requestBody = {
      conversation_id: conversationId,
      messages: [...derivedMessages, message],
      
      // 动态参数（来自session.params）
      ...(baseParams.temperature !== undefined && { 
        temperature: baseParams.temperature 
      }),
      ...(baseParams.top_p !== undefined && { 
        top_p: baseParams.top_p 
      }),
      
      // Model Card ID（必需参数）
      model_card_id: currentSession.model_card_id!,
      
      // 动态知识库
      kb_ids: kbIdsArray,
      
      // 动态Role Prompt
      ...(baseParams.role_prompt !== undefined && { 
        role_prompt: baseParams.role_prompt 
      }),
    };

    // ========== 步骤5: 发送SSE请求 ==========
    const res = await send(requestBody, controller);

    // ========== 步骤6: 错误处理 ==========
    if (res && (res?.response.status !== 200 || res?.data?.code !== 0)) {
      setValue(message.content);  // 恢复输入框内容
      removeLatestMessage();      // 删除失败的消息
    }
  },
  [
    dialogId,
    currentSession,
    derivedMessages,
    enabledKBs,
    updateConversation,
    updateSession,
    send,
    controller,
    removeLatestMessage,
    setValue,
    t,
  ],
);
```

### 消息同步到会话

derivedMessages变更时自动同步到当前会话：

```typescript
useEffect(() => {
  if (currentSessionId && derivedMessages.length > 0) {
    updateSession(currentSessionId, {
      messages: derivedMessages,
    });
  }
}, [derivedMessages, currentSessionId, updateSession]);
```

### handlePressEnter() 发送触发

```typescript
const handlePressEnter = useCallback(() => {
  if (trim(value) === '') return;
  if (sendLoading) return;

  // 创建用户消息对象
  const message: Message = {
    id: buildMessageUuid(),
    role: MessageType.User,
    content: value,
  };

  // 添加到消息列表
  addNewestQuestion(message);

  // 清空输入框
  setValue('');

  // 发送消息
  sendMessage(message);
}, [
  value,
  sendLoading,
  addNewestQuestion,
  setValue,
  sendMessage,
]);
```

### 返回的API接口

```typescript
return {
  // 消息相关
  handlePressEnter,          // 发送消息
  handleInputChange,         // 输入框变更
  value,                     // 输入框值
  setValue,                  // 设置输入框
  derivedMessages,           // 消息列表
  removeMessageById,         // 删除指定消息
  removeAllMessages,         // 清空消息
  regenerateMessage,         // 重新生成消息
  
  // 状态
  sendLoading: !done,        // 发送中状态
  
  // 滚动相关
  scrollRef,                 // 滚动容器ref
  messageContainerRef,       // 消息容器ref
  stopOutputMessage,         // 停止生成
  
  // 会话管理
  sessions,                  // 会话列表
  currentSessionId,          // 当前会话ID
  currentSession,            // 当前会话对象
  createSession,             // 创建会话
  switchSession,             // 切换会话
  deleteSession,             // 删除会话
  clearAllSessions,          // 清空会话
  updateSession,             // 更新会话
  
  // Dialog
  dialogId,                  // 当前Bot ID
  setDialogId,               // 设置Bot ID
};
```

---

## use-free-chat-session 会话管理

### 文件信息
- **路径**: `use-free-chat-session.ts`
- **行数**: 158行
- **职责**: 会话CRUD操作

### IFreeChatSession 接口定义

```typescript
export interface IFreeChatSession {
  id: string;                        // 会话唯一ID（UUID）
  conversation_id?: string;          // RAGFlow conversation ID
  model_card_id?: number;            // Model Card ID
  name: string;                      // 会话名称
  messages: Message[];               // 消息列表
  created_at: number;                // 创建时间戳
  updated_at: number;                // 更新时间戳
  params?: {                         // 会话级参数（覆盖Model Card默认值）
    temperature?: number;
    top_p?: number;
    role_prompt?: string;
  };
}
```

### createSession() 创建会话

```typescript
const createSession = useCallback((name?: string, model_card_id?: number) => {
  let newSession: IFreeChatSession;

  setSessions(prevSessions => {
    newSession = {
      id: uuid(),                    // 生成UUID
      name: name || '新对话',         // 默认名称
      model_card_id,                  // 可选的Model Card ID
      messages: [],                   // 空消息列表
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    
    const updatedSessions = [newSession, ...prevSessions];  // 新会话置顶
    saveSessions(updatedSessions);  // 触发保存
    return updatedSessions;
  });

  setCurrentSessionId(newSession!.id);  // 自动切换到新会话
  return newSession!;
}, [saveSessions]);
```

**特性**：
- ✅ 自动生成UUID
- ✅ 新会话置顶
- ✅ 自动切换到新会话
- ✅ 触发保存回调

### updateSession() 更新会话

```typescript
const updateSession = useCallback((
  sessionId: string, 
  updates: Partial<IFreeChatSession>
) => {
  setSessions(prevSessions => {
    const updatedSessions = prevSessions.map(s =>
      s.id === sessionId
        ? { ...s, ...updates, updated_at: Date.now() }  // 合并更新
        : s
    );
    saveSessions(updatedSessions);
    return updatedSessions;
  });
}, [saveSessions]);
```

**特性**：
- ✅ 部分字段更新
- ✅ 自动更新`updated_at`
- ✅ 触发保存回调

### switchSession() 切换会话

```typescript
const switchSession = useCallback((sessionId: string) => {
  setSessions(prevSessions => {
    if (prevSessions.find(s => s.id === sessionId)) {
      setCurrentSessionId(sessionId);
    }
    return prevSessions;  // 不修改sessions数组
  });
}, []);
```

**BUG FIX #11**：
- 使用函数式setState避免闭包问题
- 不依赖外部的`currentSessionId`

### deleteSession() 删除会话

```typescript
const deleteSession = useCallback((sessionId: string) => {
  let shouldUpdateCurrentId = false;
  let newCurrentId = '';

  setSessions(prevSessions => {
    const updatedSessions = prevSessions.filter(s => s.id !== sessionId);
    saveSessions(updatedSessions);

    // 如果删除的是当前会话，自动切换到第一个会话
    if (sessionId === currentSessionId) {
      shouldUpdateCurrentId = true;
      if (updatedSessions.length > 0) {
        newCurrentId = updatedSessions[0].id;
      }
    }

    return updatedSessions;
  });

  // 更新当前会话ID
  if (shouldUpdateCurrentId) {
    setCurrentSessionId(newCurrentId);
  }
}, [currentSessionId, saveSessions]);
```

**特性**：
- ✅ 删除后自动切换
- ✅ 无会话时清空`currentSessionId`

---

## use-free-chat-settings-api 设置同步

### 文件信息
- **路径**: `use-free-chat-settings-api.ts`
- **行数**: 243行
- **职责**: 与后端API交互，管理用户设置

### FreeChatSettings 接口

```typescript
interface FreeChatSettings {
  user_id: string;
  dialog_id: string;
  model_params: DynamicModelParams;
  kb_ids: string[];
  role_prompt: string;
  sessions: IFreeChatSession[];
}
```

### loadSettings() 加载设置

```typescript
const loadSettings = useCallback(async () => {
  if (!userId) {
    setSettings(null);
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    const { data: response } = await request(api.getFreeChatSettings, {
      method: 'GET',
      params: { user_id: userId },
    });

    if (response.code === 0) {
      setSettings(response.data);
      logInfo(`Loaded settings for user ${userId}`, 'useFreeChatSettingsApi');
    } else if (response.code === 102) {
      // 认证错误 - 跳转到未授权页面
      history.push(Routes.FreeChatUnauthorized);
    } else {
      // 首次访问，使用默认设置
      const defaultSettings: FreeChatSettings = {
        user_id: userId,
        ...DEFAULT_SETTINGS,
      };
      setSettings(defaultSettings);
    }
    setError(null);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Failed to load settings';
    logError(errorMsg, 'useFreeChatSettingsApi.loadSettings');
    setError(errorMsg);
    // 错误时使用默认设置
    setSettings({
      user_id: userId,
      ...DEFAULT_SETTINGS,
    });
  } finally {
    setLoading(false);
  }
}, [userId]);
```

### saveToAPI() 保存设置

```typescript
const saveToAPI = useCallback(async () => {
  if (!userId || !settings) {
    return false;
  }

  try {
    setSaving(true);
    const { data: response } = await request(api.saveFreeChatSettings, {
      method: 'POST',
      data: settings,
    });

    if (response.code === 0) {
      setSettings(response.data);      // 使用服务器返回的数据
      setHasUnsavedChanges(false);     // 清除未保存标记
      return true;
    } else if (response.code === 102) {
      // 认证错误
      history.push(Routes.FreeChatUnauthorized);
      return false;
    } else {
      logError(`Failed to save settings: ${response.message}`, 'saveToAPI');
      return false;
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Failed to save settings';
    logError(errorMsg, 'useFreeChatSettingsApi.saveToAPI');
    return false;
  } finally {
    setSaving(false);
  }
}, [userId, settings]);
```

### updateField() 防抖更新

```typescript
const updateField = useCallback(
  <K extends keyof Omit<FreeChatSettings, 'user_id'>>(
    field: K,
    value: FreeChatSettings[K],
    options?: { silent?: boolean; immediate?: boolean }
  ) => {
    const silent = options?.silent ?? false;
    const immediate = options?.immediate ?? false;

    if (!settings) return;

    // 立即更新本地状态
    const updatedSettings = { ...settings, [field]: value };
    setSettings(updatedSettings);

    // 设置未保存标记（除非silent模式）
    if (!silent) {
      setHasUnsavedChanges(true);
    }

    // 清除旧定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // 立即保存或防抖保存
    if (immediate) {
      setTimeout(() => saveToAPI(), 0);
    } else {
      // sessions: 5s防抖，其他字段: 30s防抖
      const debounceTime = field === 'sessions' ? 5000 : 30000;
      autoSaveTimerRef.current = setTimeout(() => {
        saveToAPI();
      }, debounceTime);
    }
  },
  [settings, saveToAPI],
);
```

**防抖策略**：
| 字段 | 防抖时间 | 原因 |
|------|---------|------|
| `sessions` | 5秒 | 高频更新（每条消息） |
| 其他字段 | 30秒 | 低频更新 |
| `immediate=true` | 立即 | 关键操作 |

---

## Hook协作关系

```
┌─────────────────────────────────────────────────────┐
│                 FreeChatContent (页面组件)           │
└─────────────────────────────────────────────────────┘
                          ↓ 调用
┌─────────────────────────────────────────────────────┐
│          useFreeChatSettingsApi(userId)             │
│  负责: 加载/保存用户设置，与后端API交互              │
│  ↓ 返回                                             │
│  - settings: FreeChatSettings                       │
│  - updateField(field, value, options)               │
└─────────────────────────────────────────────────────┘
                          ↓ settings作为prop
┌─────────────────────────────────────────────────────┐
│   useFreeChat(controller, userId, settings,         │
│                onSessionsChange)                    │
│  负责: 编排所有业务逻辑                              │
└─────────────────────────────────────────────────────┘
    ↓ 使用                ↓ 使用                ↓ 使用
┌─────────────┐  ┌─────────────────┐  ┌──────────────┐
│useFreChat   │  │useSendMessage   │  │useKBContext  │
│Session      │  │WithSse          │  │              │
│             │  │                 │  │              │
│管理会话列表  │  │SSE流式通信      │  │知识库选择     │
└─────────────┘  └─────────────────┘  └──────────────┘
       ↓ onSessionsChange回调
┌─────────────────────────────────────────────────────┐
│  updateField('sessions', newSessions, {silent:true})│
│  → 5秒后自动保存到后端                               │
└─────────────────────────────────────────────────────┘
```

---

## 消息发送完整流程

```
1. 用户输入 "你好" → handleInputChange()
   ↓
2. 用户按Enter → handlePressEnter()
   ↓
3. 创建Message对象
   {
     id: "msg-uuid-123",
     role: "user",
     content: "你好"
   }
   ↓
4. addNewestQuestion(message)
   derivedMessages = [...derivedMessages, message]
   ↓
5. sendMessage(message)
   ├─ 检查currentSession.conversation_id
   │  └─ 不存在 → updateConversation() 创建
   │     └─ 成功 → updateSession(session.id, {conversation_id})
   ├─ 构建requestBody
   │  ├─ conversation_id
   │  ├─ messages: derivedMessages
   │  ├─ model_card_id: currentSession.model_card_id
   │  ├─ temperature: session.params.temperature
   │  ├─ kb_ids: Array.from(enabledKBs)
   │  └─ role_prompt: session.params.role_prompt
   └─ send(requestBody, controller) → SSE请求
   ↓
6. SSE流式响应
   data: {"answer": "你", "reference": []}
   data: {"answer": "你好", "reference": []}
   data: {"answer": "你好！", "reference": []}
   data: true  ← 结束标记
   ↓
7. addNewestAnswer(answer)
   derivedMessages = [...derivedMessages, {
     id: "answer-uuid-456",
     role: "assistant",
     content: "你好！我是AI助手"
   }]
   ↓
8. derivedMessages更新 → useEffect触发
   updateSession(currentSessionId, {
     messages: derivedMessages
   })
   ↓
9. onSessionsChange(newSessions) → 回调触发
   ↓
10. updateField('sessions', newSessions, {silent: true})
    ↓ 5秒防抖
11. saveToAPI()
    POST /v1/free_chat/settings
    ↓
12. 保存成功
    ✅ Redis缓存更新
    ✅ MySQL持久化
```

---

## 总结

### Hook职责划分

| Hook | 核心职责 | 主要功能 |
|------|---------|---------|
| `useFreeChat` | 业务逻辑编排 | 组合所有功能，提供统一接口 |
| `useFreeChatSession` | 会话状态管理 | CRUD操作，内存状态 |
| `useFreeChatSettingsApi` | 后端同步 | 加载/保存设置，防抖 |
| `useSendMessageWithSse` | SSE通信 | 流式请求，实时响应 |
| `useKBContext` | 知识库管理 | 选择/切换知识库 |

### 性能优化要点

✅ **防抖保存** - sessions 5s，其他 30s  
✅ **函数式setState** - 避免闭包问题  
✅ **依赖优化** - 仅在必要时触发effect  
✅ **React Query缓存** - Model Cards缓存5分钟

---

**相关文档**：
- [07_页面入口与路由.md](./07_页面入口与路由.md) - 页面组件详解
- [17_SSE流式通信.md](./17_SSE流式通信.md) - SSE实现细节
- [16_完整数据流.md](./16_完整数据流.md) - 端到端流程

**代码位置**: `web/src/pages/free-chat/hooks/`  
**最后更新**: 2024年
