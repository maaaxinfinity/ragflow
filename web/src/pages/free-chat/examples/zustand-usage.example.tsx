/**
 * Zustand Store 使用示例
 * 展示如何使用 FreeChat Zustand Store 管理会话状态
 */

import { MessageType } from '@/constants/chat';
import { Button, Input, List, message as antdMessage } from 'antd';
import React from 'react';
import { v4 as uuid } from 'uuid';
import {
  useCurrentMessages,
  useCurrentSession,
  useFreeChatStore,
  useMessageActions,
  useSessionActions,
  useSessions,
} from '../stores/free-chat-store';

// ==================== 示例 1: 基础使用 ====================

export function BasicExample() {
  // 使用选择器获取状态（性能优化）
  const sessions = useSessions();
  const currentSession = useCurrentSession();
  const { createSession, switchSession, deleteSession } = useSessionActions();

  return (
    <div>
      <h2>会话列表</h2>
      <Button onClick={() => createSession()}>新建会话</Button>

      <List
        dataSource={sessions}
        renderItem={(session) => (
          <List.Item
            actions={[
              <Button onClick={() => switchSession(session.id)}>切换</Button>,
              <Button onClick={() => deleteSession(session.id)} danger>
                删除
              </Button>,
            ]}
            style={{
              backgroundColor:
                currentSession?.id === session.id ? '#e6f7ff' : 'white',
            }}
          >
            <List.Item.Meta
              title={session.name}
              description={`${session.messages.length} 条消息`}
            />
          </List.Item>
        )}
      />
    </div>
  );
}

// ==================== 示例 2: 消息管理 ====================

export function MessageExample() {
  const messages = useCurrentMessages();
  const { addMessage, updateMessage, removeMessage } = useMessageActions();
  const [inputValue, setInputValue] = React.useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage = {
      id: uuid(),
      content: inputValue,
      role: MessageType.User,
    };

    addMessage(newMessage);
    setInputValue('');
    antdMessage.success('消息已发送');
  };

  return (
    <div>
      <h2>当前会话消息</h2>

      <List
        dataSource={messages}
        renderItem={(msg) => (
          <List.Item
            actions={[
              <Button onClick={() => removeMessage(msg.id)} size="small" danger>
                删除
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={msg.role === MessageType.User ? '用户' : '助手'}
              description={msg.content}
            />
          </List.Item>
        )}
      />

      <div style={{ marginTop: 16 }}>
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="输入消息..."
          rows={3}
        />
        <Button onClick={handleSend} type="primary" style={{ marginTop: 8 }}>
          发送
        </Button>
      </div>
    </div>
  );
}

// ==================== 示例 3: 完整集成 ====================

export function FullExample() {
  const store = useFreeChatStore();

  // 从服务器加载会话（与 React Query 集成）
  React.useEffect(() => {
    // 假设从 API 获取会话
    const loadedSessions = [
      {
        id: '1',
        name: 'Chat 1',
        messages: [],
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ];

    store.setSessions(loadedSessions);
  }, []);

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <BasicExample />
      </div>
      <div style={{ flex: 2 }}>
        <MessageExample />
      </div>
    </div>
  );
}

// ==================== 示例 4: 与 React Query 集成 ====================

import {
  useFreeChatSettings,
  useUpdateSettingsField,
} from '../hooks/use-free-chat-settings-query';

export function IntegratedExample() {
  const userId = 'user_123';
  const sessions = useSessions();
  const { data: settings } = useFreeChatSettings(userId);
  const updateField = useUpdateSettingsField(userId);

  // 同步会话到服务器（静默模式，不触发"未保存"提示）
  React.useEffect(() => {
    if (settings && sessions) {
      updateField('sessions', sessions, { silent: true });
    }
  }, [sessions, settings, updateField]);

  return (
    <div>
      <h2>集成示例</h2>
      <p>会话自动同步到服务器</p>
      <p>当前会话数: {sessions.length}</p>
      <p>服务器设置状态: {settings ? '已加载' : '加载中...'}</p>
    </div>
  );
}

// ==================== 示例 5: 性能优化 ====================

/**
 * ✅ 推荐：使用选择器只订阅需要的状态
 */
function OptimizedComponent() {
  // 只订阅会话列表，不订阅其他状态
  const sessions = useSessions();

  return <div>会话数: {sessions.length}</div>;
}

/**
 * ❌ 不推荐：订阅整个 store
 */
function UnoptimizedComponent() {
  // 订阅了整个 store，任何状态变化都会导致重新渲染
  const store = useFreeChatStore();

  return <div>会话数: {store.sessions.length}</div>;
}

// ==================== 示例 6: 批量操作 ====================

export function BatchOperationsExample() {
  const { createSession, deleteSession, clearAllSessions } =
    useSessionActions();

  const handleCreateMultiple = () => {
    // 创建多个会话
    for (let i = 0; i < 5; i++) {
      createSession(`批量创建 ${i + 1}`);
    }
    antdMessage.success('已创建 5 个会话');
  };

  const handleClearAll = () => {
    if (confirm('确定清空所有会话？')) {
      clearAllSessions();
      antdMessage.success('已清空所有会话');
    }
  };

  return (
    <div>
      <h2>批量操作</h2>
      <Button onClick={handleCreateMultiple}>批量创建 5 个会话</Button>
      <Button onClick={handleClearAll} danger style={{ marginLeft: 8 }}>
        清空所有会话
      </Button>
    </div>
  );
}

// ==================== 示例 7: 会话重命名 ====================

export function RenameExample() {
  const currentSession = useCurrentSession();
  const { updateSession } = useSessionActions();
  const [newName, setNewName] = React.useState('');

  const handleRename = () => {
    if (!currentSession || !newName.trim()) return;

    updateSession(currentSession.id, { name: newName });
    setNewName('');
    antdMessage.success('会话已重命名');
  };

  if (!currentSession) {
    return <div>请先选择一个会话</div>;
  }

  return (
    <div>
      <h2>重命名会话</h2>
      <p>当前会话: {currentSession.name}</p>
      <Input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="输入新名称..."
        style={{ width: 200 }}
      />
      <Button onClick={handleRename} style={{ marginLeft: 8 }}>
        重命名
      </Button>
    </div>
  );
}
