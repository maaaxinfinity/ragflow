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
import { useListTenantUser, useFetchUserInfo, useFetchTenantInfo } from '@/hooks/user-setting-hooks';
import chatService from '@/services/next-chat-service';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';

// BUG FIX: Separate component to use hooks inside KBProvider
function FreeChatContent() {
  const controller = useRef(new AbortController());
  const userId = useFreeChatUserId();
  const [searchParams] = useSearchParams();
  const {
    settings,
    loading: settingsLoading,
    saving: settingsSaving,
    hasUnsavedChanges,
    updateField,
    manualSave,
  } = useFreeChatSettingsApi(userId);

  // Fetch tenant info (required for team queries)
  const { data: tenantInfo, loading: tenantInfoLoading } = useFetchTenantInfo();

  // Fetch current user info
  const { data: userInfo } = useFetchUserInfo();

  // Fetch tenant users to get user info by user_id (only after tenantInfo is loaded)
  const { data: tenantUsers = [] } = useListTenantUser();

  // Find current user info from tenant users
  const currentUserInfo = tenantUsers.find(user => user.user_id === userId);

  // Handle sessions change with debounce (5 seconds)
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

  // Require user_id parameter for access control
  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Access Denied</p>
          <p className="text-muted-foreground">This page requires a user_id parameter to access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
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
      <div className="flex-1 flex flex-col min-w-0">
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
        saving={settingsSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        onManualSave={manualSave}
      />

      {/* User Info Display - Bottom Right */}
      {userId && currentUserInfo && tenantInfo && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-card/95 backdrop-blur-md border-2 border-primary/20 rounded-xl px-4 py-2.5 shadow-lg hover:shadow-xl transition-all duration-200">
          <RAGFlowAvatar
            name={currentUserInfo.nickname || currentUserInfo.email}
            avatar={currentUserInfo.avatar}
            isPerson={true}
            className="w-9 h-9 ring-2 ring-primary/20"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {currentUserInfo.nickname || currentUserInfo.email}
            </span>
            {currentUserInfo.nickname && currentUserInfo.email && (
              <span className="text-xs text-muted-foreground">
                {currentUserInfo.email}
              </span>
            )}
            {tenantInfo.name && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                团队：{tenantInfo.name}
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
    document.body.style.fontFamily = '"KingHwa_OldSong", serif';

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
      <div style={{ fontFamily: '"KingHwa_OldSong", serif' }}>
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
