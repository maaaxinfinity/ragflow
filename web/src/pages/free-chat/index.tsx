import { useRef, useEffect, useCallback, useState } from 'react';
import { useFreeChat } from './hooks/use-free-chat';
import { ControlPanel } from './components/control-panel';
import { ChatInterface } from './chat-interface';
import { SessionList } from './components/session-list';
import { KBProvider } from './contexts/kb-context';
import { useFreeChatUserId } from './hooks/use-free-chat-user-id';
import { useFreeChatSettingsApi } from './hooks/use-free-chat-settings-api';
import { Spin } from 'antd';
import { Helmet, useSearchParams } from 'umi';
import { useListTenantUser } from '@/hooks/user-setting-hooks';
import chatService from '@/services/next-chat-service';

// BUG FIX: Separate component to use hooks inside KBProvider
function FreeChatContent() {
  const controller = useRef(new AbortController());
  const userId = useFreeChatUserId();
  const [searchParams] = useSearchParams();
  const { settings, loading: settingsLoading, updateField } = useFreeChatSettingsApi(userId);

  // Fetch tenant users to get user info by user_id
  const { data: tenantUsers = [] } = useListTenantUser();

  // Find current user info from tenant users
  const currentUserInfo = tenantUsers.find(user => user.user_id === userId);

  const handleSessionsChange = useCallback(
    (sessions: any[]) => {
      if (userId && settings) {
        updateField('sessions', sessions);
      }
    },
    [userId, settings, updateField],
  );

  const {
    handlePressEnter,
    handleInputChange,
    value,
    setValue,
    derivedMessages,
    removeMessageById,
    removeAllMessages,
    regenerateMessage,
    sendLoading,
    scrollRef,
    messageContainerRef,
    stopOutputMessage,
    sessions,
    currentSessionId,
    createSession,
    switchSession,
    deleteSession,
    clearAllSessions,
    updateSession,
    dialogId,
    setDialogId,
  } = useFreeChat(controller.current, userId, settings, handleSessionsChange);

  const [loadedConversationId, setLoadedConversationId] = useState<string>('');
  const [hasSetInitialDialogId, setHasSetInitialDialogId] = useState(false);

  // Use ref to track latest sessions without causing re-renders
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Set dialog_id from URL parameter if present (only once on mount)
  useEffect(() => {
    if (hasSetInitialDialogId) return;

    const urlDialogId = searchParams.get('dialog_id');
    if (urlDialogId && urlDialogId !== dialogId) {
      setDialogId(urlDialogId);
      if (userId && settings) {
        updateField('dialog_id', urlDialogId);
      }
      setHasSetInitialDialogId(true);
    }
  }, [searchParams, dialogId, setDialogId, userId, settings, updateField, hasSetInitialDialogId]);

  // Load conversation from URL parameter if present
  useEffect(() => {
    const conversationId = searchParams.get('conversation_id');

    // Skip if no conversation_id or already loaded
    if (!conversationId || conversationId === loadedConversationId) {
      return;
    }

    // Check if session with this conversation_id already exists (use ref for latest value)
    const existingSession = sessionsRef.current.find(s => s.conversation_id === conversationId);
    if (existingSession) {
      // Switch to existing session
      switchSession(existingSession.id);
      setLoadedConversationId(conversationId);
      return;
    }

    // Load conversation from API
    let isCancelled = false;
    const loadConversation = async () => {
      try {
        const { data } = await chatService.getConversation(
          { params: { conversation_id: conversationId } },
          true
        );

        // Check if this effect was cancelled (e.g., conversation_id changed)
        if (isCancelled) return;

        if (data.code === 0 && data.data) {
          const conversation = data.data;

          // Create new session with conversation data
          const newSession = createSession(conversation.name || 'Chat from conversation');

          // Update session with conversation_id and messages
          if (newSession && conversation.message) {
            updateSession(newSession.id, {
              conversation_id: conversationId,
              messages: conversation.message,
            });
          }

          setLoadedConversationId(conversationId);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load conversation:', error);
        }
      }
    };

    loadConversation();

    // Cleanup function to cancel ongoing request if conversation_id changes
    return () => {
      isCancelled = true;
    };
  }, [searchParams, loadedConversationId, switchSession, createSession, updateSession]);

  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  const handleSessionRename = useCallback(
    (sessionId: string, newName: string) => {
      updateSession(sessionId, { name: newName });
    },
    [updateSession],
  );

  const handleDialogChange = useCallback(
    (newDialogId: string) => {
      // Check if dialog actually changed
      if (dialogId && dialogId !== newDialogId) {
        // Dialog changed - create new chat session
        createSession();
      }

      setDialogId(newDialogId);
      if (userId && settings) {
        updateField('dialog_id', newDialogId);
      }
    },
    [dialogId, createSession, setDialogId, userId, settings, updateField],
  );

  const handleRolePromptChange = useCallback(
    (prompt: string) => {
      if (userId && settings) {
        updateField('role_prompt', prompt);
      }
    },
    [userId, settings, updateField],
  );

  const handleModelParamsChange = useCallback(
    (params: any) => {
      if (userId && settings) {
        updateField('model_params', params);
      }
    },
    [userId, settings, updateField],
  );

  // Show loading state while settings are being loaded
  if (settingsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Session List */}
      <SessionList
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={switchSession}
        onSessionDelete={deleteSession}
        onSessionRename={handleSessionRename}
        onNewSession={handleNewSession}
        onClearAll={clearAllSessions}
      />

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        <ChatInterface
          messages={derivedMessages}
          onSendMessage={handlePressEnter}
          onInputChange={handleInputChange}
          inputValue={value}
          setInputValue={setValue}
          sendLoading={sendLoading}
          scrollRef={scrollRef}
          messageContainerRef={messageContainerRef}
          stopOutputMessage={stopOutputMessage}
          removeMessageById={removeMessageById}
          removeAllMessages={removeAllMessages}
          regenerateMessage={regenerateMessage}
          dialogId={dialogId}
        />
      </div>

      {/* Control Panel */}
      <ControlPanel
        dialogId={dialogId}
        onDialogChange={handleDialogChange}
        rolePrompt={settings?.role_prompt || ''}
        onRolePromptChange={handleRolePromptChange}
        modelParams={settings?.model_params}
        onModelParamsChange={handleModelParamsChange}
      />

      {/* User Info Display - Bottom Right */}
      {userId && currentUserInfo && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-white dark:bg-gray-800 border rounded-lg px-3 py-2 shadow-md">
          {currentUserInfo.avatar && (
            <img
              src={currentUserInfo.avatar}
              alt={currentUserInfo.nickname || currentUserInfo.email}
              className="w-8 h-8 rounded-full"
            />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {currentUserInfo.nickname || currentUserInfo.email}
            </span>
            {currentUserInfo.nickname && currentUserInfo.email && (
              <span className="text-xs text-muted-foreground">
                {currentUserInfo.email}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FreeChat() {
  const userId = useFreeChatUserId();
  const { settings, updateField } = useFreeChatSettingsApi(userId);

  // Apply 京华老宋体 font
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://chinese-fonts-cdn.deno.dev/packages/jhlst/dist/%E4%BA%AC%E8%8F%AF%E8%80%81%E5%AE%8B%E4%BD%93v1_007/result.css';
    document.head.appendChild(link);

    // Apply font to body
    document.body.style.fontFamily = '"京华老宋体", serif';

    return () => {
      document.head.removeChild(link);
      document.body.style.fontFamily = '';
    };
  }, []);

  return (
    <>
      <Helmet>
        <link
          rel="stylesheet"
          href="https://chinese-fonts-cdn.deno.dev/packages/jhlst/dist/%E4%BA%AC%E8%8F%AF%E8%80%81%E5%AE%8B%E4%BD%93v1_007/result.css"
        />
      </Helmet>
      <div style={{ fontFamily: '"京华老宋体", serif' }}>
        <KBProvider
          initialKBs={settings?.kb_ids}
          onKBsChange={(kbIds) => updateField('kb_ids', kbIds)}
        >
          <FreeChatContent />
        </KBProvider>
      </div>
    </>
  );
}
