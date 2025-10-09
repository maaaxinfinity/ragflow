# FreeChat Store 使用示例

本文档提供了实际的代码示例，展示如何在FreeChat中使用新的Zustand Store。

---

## 📚 目录

1. [基础示例](#基础示例)
2. [高级示例](#高级示例)
3. [性能优化示例](#性能优化示例)
4. [实战场景](#实战场景)

---

## 基础示例

### 示例1: 创建和切换会话

```typescript
import { useSessionStore } from './store/session';

function SessionList() {
  const sessions = useSessionStore((state) => state.sessions);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const createSession = useSessionStore((state) => state.createSession);
  const switchSession = useSessionStore((state) => state.switchSession);

  const handleNewSession = () => {
    // 创建新会话，自动切换到新会话
    const newSession = createSession('新对话', modelCardId);
    console.log('Created session:', newSession.id);
  };

  return (
    <div>
      <button onClick={handleNewSession}>新建对话</button>
      
      <ul>
        {sessions.map(session => (
          <li
            key={session.id}
            className={session.id === currentSessionId ? 'active' : ''}
            onClick={() => switchSession(session.id)}
          >
            {session.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 示例2: 发送和显示消息

```typescript
import { useMessageStore } from './store/message';
import { useSessionStore } from './store/session';

function ChatInterface() {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const messages = useMessageStore((state) => 
    state.getMessages(currentSessionId)
  );
  const addUserMessage = useMessageStore((state) => state.addUserMessage);
  
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    // 添加用户消息
    addUserMessage(currentSessionId, input);
    setInput('');
    
    // 发送到后端...
  };

  return (
    <div>
      {/* 消息列表 */}
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      
      {/* 输入框 */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
      />
      <button onClick={handleSend}>发送</button>
    </div>
  );
}
```

### 示例3: 更新会话信息

```typescript
function SessionSettings() {
  const currentSession = useSessionStore((state) => state.currentSession);
  const updateSession = useSessionStore((state) => state.updateSession);
  const updateSessionParams = useSessionStore((state) => state.updateSessionParams);

  const handleRename = (newName: string) => {
    if (currentSession) {
      updateSession(currentSession.id, { name: newName });
    }
  };

  const handleTemperatureChange = (temperature: number) => {
    if (currentSession) {
      updateSessionParams(currentSession.id, { temperature });
    }
  };

  if (!currentSession) return <div>请选择会话</div>;

  return (
    <div>
      <input
        value={currentSession.name}
        onChange={(e) => handleRename(e.target.value)}
      />
      
      <label>
        温度: {currentSession.params?.temperature ?? 0.7}
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={currentSession.params?.temperature ?? 0.7}
          onChange={(e) => handleTemperatureChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
```

---

## 高级示例

### 示例4: 使用 Enhanced Hook

```typescript
import { useFreeChatEnhanced } from './hooks/use-free-chat-enhanced';

function FreeChatPage() {
  const controller = useRef(new AbortController());
  
  const {
    // 消息
    derivedMessages,
    handlePressEnter,
    value,
    handleInputChange,
    removeMessageById,
    
    // 会话
    sessions,
    currentSession,
    currentSessionId,
    createSession,
    switchSession,
    updateSession,
    deleteSession,
    
    // 状态
    sendLoading,
    scrollRef,
  } = useFreeChatEnhanced(controller.current, {
    userId: 'user_123',
    settings: {
      dialog_id: 'dialog_456',
      sessions: [], // 从API加载
    },
    onSessionsChange: (sessions) => {
      // 保存到后端
      console.log('Sessions changed:', sessions.length);
      // api.saveSettings({ sessions });
    },
  });

  return (
    <div className="freechat-page">
      {/* 左侧会话列表 */}
      <aside>
        <button onClick={() => createSession('新对话', 123)}>
          新建对话
        </button>
        {sessions.map(s => (
          <div 
            key={s.id}
            onClick={() => switchSession(s.id)}
            className={s.id === currentSessionId ? 'active' : ''}
          >
            {s.name}
          </div>
        ))}
      </aside>

      {/* 中间聊天区域 */}
      <main ref={scrollRef}>
        {derivedMessages.map(msg => (
          <div key={msg.id} className={msg.role}>
            {msg.content}
            <button onClick={() => removeMessageById(msg.id)}>删除</button>
          </div>
        ))}
      </main>

      {/* 输入框 */}
      <footer>
        <input
          value={value}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && handlePressEnter()}
          disabled={!currentSession || sendLoading}
        />
      </footer>
    </div>
  );
}
```

### 示例5: SSE 流式消息更新

```typescript
import { useMessageStore } from './store/message';
import { useCallback, useEffect } from 'react';

function StreamingChat() {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const updateLastAssistantMessage = useMessageStore(
    (state) => state.updateLastAssistantMessage
  );
  const addAssistantMessage = useMessageStore(
    (state) => state.addAssistantMessage
  );

  const handleSSEMessage = useCallback((chunk: string) => {
    // 流式更新最后一条助手消息
    updateLastAssistantMessage(currentSessionId, chunk);
  }, [currentSessionId, updateLastAssistantMessage]);

  const handleSSEStart = useCallback(() => {
    // 开始时添加空的助手消息
    addAssistantMessage(currentSessionId, '', []);
  }, [currentSessionId, addAssistantMessage]);

  // 使用SSE
  useEffect(() => {
    const eventSource = new EventSource('/api/chat/stream');
    
    eventSource.addEventListener('start', handleSSEStart);
    eventSource.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      handleSSEMessage(data.content);
    });

    return () => eventSource.close();
  }, [handleSSEStart, handleSSEMessage]);

  return <ChatInterface />;
}
```

### 示例6: 会话复制和删除

```typescript
function SessionActions({ sessionId }: { sessionId: string }) {
  const duplicateSession = useSessionStore((state) => state.duplicateSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);

  const handleDuplicate = () => {
    const duplicated = duplicateSession(sessionId, '副本');
    if (duplicated) {
      message.success(`已复制为: ${duplicated.name}`);
    }
  };

  const handleDelete = () => {
    if (confirm('确定删除此会话？')) {
      deleteSession(sessionId);
      message.success('已删除');
    }
  };

  return (
    <div className="session-actions">
      <button onClick={handleDuplicate}>复制</button>
      <button onClick={handleDelete} className="danger">删除</button>
    </div>
  );
}
```

---

## 性能优化示例

### 示例7: 使用 Selectors

```typescript
import { sessionSelectors } from './store/session';

// ✅ 好的做法 - 使用预定义的selectors
function OptimizedComponent() {
  const currentSession = useSessionStore(sessionSelectors.currentSession);
  const hasSession = useSessionStore(sessionSelectors.hasSession);
  const sessionCount = useSessionStore(sessionSelectors.sessionCount);

  return (
    <div>
      <p>会话数: {sessionCount}</p>
      {hasSession && <p>当前: {currentSession?.name}</p>}
    </div>
  );
}
```

### 示例8: 使用 useShallow 避免重渲染

```typescript
import { useShallow } from 'zustand/react/shallow';

function MultipleStateComponent() {
  // ❌ 每次store更新都会重渲染
  const badState = useSessionStore((state) => ({
    sessions: state.sessions,
    currentId: state.currentSessionId,
  }));

  // ✅ 只在值实际变化时重渲染
  const goodState = useSessionStore(
    useShallow((state) => ({
      sessions: state.sessions,
      currentId: state.currentSessionId,
    }))
  );

  return <div>...</div>;
}
```

### 示例9: 分离状态和操作订阅

```typescript
function SeparatedComponent() {
  // ✅ 操作函数稳定，不会导致重渲染
  const createSession = useSessionStore((state) => state.createSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  
  // ✅ 只订阅需要的状态
  const sessionCount = useSessionStore((state) => state.sessions.length);

  // 这个组件只在 sessionCount 变化时重渲染
  return (
    <div>
      <p>总共 {sessionCount} 个会话</p>
      <button onClick={() => createSession()}>新建</button>
    </div>
  );
}
```

---

## 实战场景

### 场景1: 从URL加载对话

```typescript
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

function LoadConversationFromURL() {
  const [searchParams] = useSearchParams();
  const createSession = useSessionStore((state) => state.createSession);
  const updateSession = useSessionStore((state) => state.updateSession);
  const switchSession = useSessionStore((state) => state.switchSession);

  useEffect(() => {
    const conversationId = searchParams.get('conversation_id');
    if (!conversationId) return;

    // 从API加载对话
    fetch(`/api/conversations/${conversationId}`)
      .then(res => res.json())
      .then(conversation => {
        // 创建新会话
        const session = createSession(
          conversation.name,
          conversation.model_card_id
        );

        // 更新会话信息
        updateSession(session.id, {
          conversation_id: conversationId,
          messages: conversation.messages || [],
        });

        // 切换到此会话
        switchSession(session.id);
      });
  }, [searchParams, createSession, updateSession, switchSession]);

  return null;
}
```

### 场景2: 定期保存到后端

```typescript
import { useEffect, useRef } from 'react';
import { useSessionStore } from './store/session';

function AutoSave() {
  const sessions = useSessionStore((state) => state.sessions);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // 清除旧定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // 5秒后保存
    timerRef.current = setTimeout(() => {
      console.log('Auto-saving sessions...');
      
      fetch('/api/save-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions }),
      })
        .then(() => console.log('Saved successfully'))
        .catch(err => console.error('Save failed:', err));
    }, 5000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [sessions]);

  return null;
}
```

### 场景3: 消息搜索和过滤

```typescript
import { useMemo } from 'react';

function SearchMessages() {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const messages = useMessageStore((state) => 
    state.getMessages(currentSessionId)
  );
  
  const [searchKeyword, setSearchKeyword] = useState('');

  // 使用useMemo缓存搜索结果
  const filteredMessages = useMemo(() => {
    if (!searchKeyword.trim()) return messages;
    
    const keyword = searchKeyword.toLowerCase();
    return messages.filter(msg =>
      msg.content.toLowerCase().includes(keyword)
    );
  }, [messages, searchKeyword]);

  return (
    <div>
      <input
        placeholder="搜索消息..."
        value={searchKeyword}
        onChange={(e) => setSearchKeyword(e.target.value)}
      />
      
      <div className="messages">
        {filteredMessages.map(msg => (
          <div key={msg.id} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 场景4: 消息重新生成

```typescript
function RegenerateMessage({ messageId }: { messageId: string }) {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const messages = useMessageStore((state) => 
    state.getMessages(currentSessionId)
  );
  const setMessages = useMessageStore((state) => state.setMessages);
  
  const handleRegenerate = async () => {
    // 找到要重新生成的消息
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;

    // 保留到该消息之前的所有消息
    const messagesBeforeThis = messages.slice(0, index + 1);
    
    // 临时更新消息列表
    setMessages(currentSessionId, messagesBeforeThis);

    try {
      // 调用API重新生成
      const response = await fetch('/api/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          session_id: currentSessionId,
          messages: messagesBeforeThis,
        }),
      });

      const newAnswer = await response.json();
      
      // 添加新回答
      useMessageStore.getState().addAssistantMessage(
        currentSessionId,
        newAnswer.content,
        newAnswer.reference
      );
    } catch (error) {
      console.error('Regenerate failed:', error);
      // 恢复原消息列表
      setMessages(currentSessionId, messages);
    }
  };

  return (
    <button onClick={handleRegenerate} title="重新生成">
      🔄
    </button>
  );
}
```

### 场景5: 会话导出和导入

```typescript
function ExportImport() {
  const sessions = useSessionStore((state) => state.sessions);
  const setSessions = useSessionStore((state) => state.setSessions);
  const messages = useMessageStore((state) => state.messages);

  const handleExport = () => {
    const data = {
      sessions,
      messages,
      exportTime: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freechat-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // 恢复会话
        setSessions(data.sessions || []);
        
        // 恢复消息
        if (data.messages) {
          Object.entries(data.messages).forEach(([sessionId, msgs]) => {
            useMessageStore.getState().setMessages(
              sessionId,
              msgs as Message[]
            );
          });
        }

        message.success('导入成功');
      } catch (error) {
        console.error('Import failed:', error);
        message.error('导入失败');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <button onClick={handleExport}>导出数据</button>
      <label>
        导入数据
        <input
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  );
}
```

---

## 调试技巧

### 使用 Redux DevTools

```typescript
// 1. 安装 Redux DevTools 浏览器扩展
// 2. 在开发环境运行应用
// 3. 打开DevTools，切换到 Redux 标签

// 你可以看到:
// - State: 当前完整状态
// - Action History: 所有操作历史
// - Diff: 状态变化差异
// - Time Travel: 回到任意历史状态
```

### 添加日志

```typescript
import { useSessionStore } from './store/session';

function DebugComponent() {
  const sessions = useSessionStore((state) => {
    console.log('[Store] Sessions updated:', state.sessions.length);
    return state.sessions;
  });

  useEffect(() => {
    console.log('[Effect] Sessions changed:', sessions);
  }, [sessions]);

  return <div>...</div>;
}
```

---

## 总结

这些示例涵盖了:
- ✅ 基础的CRUD操作
- ✅ SSE流式消息处理
- ✅ 性能优化技巧
- ✅ 实际业务场景
- ✅ 调试方法

建议按照以下顺序学习:
1. 先掌握基础示例1-3
2. 再学习高级示例4-6
3. 了解性能优化7-9
4. 最后参考实战场景

**下一步**: 阅读 `INTEGRATION_GUIDE.md` 了解完整的集成步骤。
