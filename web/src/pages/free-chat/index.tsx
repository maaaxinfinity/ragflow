import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useFreeChat } from './hooks/use-free-chat';
import { ControlPanel } from './components/control-panel';
import { ChatInterface } from './chat-interface';
import { SidebarDualTabs } from './components/sidebar-dual-tabs';
import { SimplifiedMessageInput } from './components/simplified-message-input';
import { KBProvider } from './contexts/kb-context';
import { useFreeChatUserId } from './hooks/use-free-chat-user-id';
import { useFreeChatSettingsApi } from './hooks/use-free-chat-settings-api';
import { Spin } from 'antd';
import { Helmet, useSearchParams } from 'umi';
import { useListTenantUser, useFetchTenantInfo } from '@/hooks/user-setting-hooks';
import { useFetchDialogList } from '@/hooks/use-chat-request';
import { useFetchModelCards } from './hooks/use-fetch-model-cards';
import chatService from '@/services/next-chat-service';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import i18n from '@/locales/config';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Settings2, X } from 'lucide-react';

// BUG FIX: Separate component to use hooks inside KBProvider
function FreeChatContent() {
  const controller = useRef(new AbortController());
  const userId = useFreeChatUserId();
  const [searchParams] = useSearchParams();
  // Right panel collapse state
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(true);
  // Mobile control panel state (for small screens)
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
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

  // Fetch current user info with user_id parameter (for beta token mode)
  const { data: userInfo } = useQuery({
    queryKey: ['freeChatUserInfo', userId],
    enabled: !!userId,
    queryFn: async () => {
      const url = `${api.user_info}?user_id=${userId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${searchParams.get('auth')}` || '',
        },
      });
      const data = await response.json();
      return data?.data ?? {};
    },
  });

  // Fetch tenant users to get user info by user_id (only after tenantInfo is loaded)
  const { data: tenantUsers = [] } = useListTenantUser();

  // Fetch dialog list to get current dialog avatar
  const { data: dialogData } = useFetchDialogList();

  // Fetch model cards
  const { data: modelCards = [] } = useFetchModelCards();

  // Handle language parameter from URL
  useEffect(() => {
    const languageParam = searchParams.get('language');
    if (languageParam) {
      // Map URL parameter to i18n language code
      const languageMap: Record<string, string> = {
        'zhcn': 'zh',
        'zhtw': 'zh-TRADITIONAL',
        'en': 'en',
      };
      const language = languageMap[languageParam.toLowerCase()] || languageParam;
      i18n.changeLanguage(language);
    }
  }, [searchParams]);

  // Find current user info from tenant users
  const currentUserInfo = Array.isArray(tenantUsers) ? tenantUsers.find(user => user.user_id === userId) : undefined;

  // Determine which team info to display
  // If user is found in tenantUsers, they are a NORMAL member -> show joined team (tenantInfo)
  // If user is NOT in tenantUsers, they are the OWNER -> show their own team (tenantInfo is already correct)
  const displayTenantInfo = tenantInfo;

  // FIX: Removed handleSessionsChange callback
  // Sessions are now managed by TanStack Query (auto-synced with backend)
  // No need to manually save to FreeChatUserSettings.sessions

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
  } = useFreeChat(controller.current, userId, settings);

  // Find current dialog by dialogId
  const currentDialog = useMemo(() => {
    return dialogData?.dialogs?.find(d => d.id === dialogId);
  }, [dialogData, dialogId]);

  // Get current session and model card
  const currentSession = sessions?.find(s => s.id === currentSessionId);
  const currentModelCard = useMemo(() => {
    if (!currentSession?.model_card_id) return null;
    return modelCards?.find(c => c.id === currentSession.model_card_id);
  }, [currentSession, modelCards]);

  // Calculate user avatar and nickname
  // Priority: userInfo (from /user/info?user_id=xxx) > currentUserInfo (from tenant users list)
  const userAvatar = userInfo?.avatar || currentUserInfo?.avatar;
  const userNickname = userInfo?.nickname || userInfo?.email || currentUserInfo?.nickname || currentUserInfo?.email || 'User';
  const dialogAvatar = currentDialog?.icon; // Use dialog icon if set, otherwise MessageItem will show default AssistantIcon

  const [loadedConversationId, setLoadedConversationId] = useState<string>('');
  const [hasSetInitialDialogId, setHasSetInitialDialogId] = useState(false);
  const [hasSetInitialModelCardId, setHasSetInitialModelCardId] = useState(false);

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

  // Handle model_card_id from URL parameter (only once on mount)
  // When user selects a model card, create a new session with that model_card_id
  useEffect(() => {
    if (hasSetInitialModelCardId) return;

    const urlModelCardId = searchParams.get('model_card_id');
    if (urlModelCardId) {
      const modelCardId = parseInt(urlModelCardId, 10);
      if (!isNaN(modelCardId)) {
        // Create new session with model_card_id
        createSession(undefined, modelCardId);
        setHasSetInitialModelCardId(true);
      }
    }
  }, [searchParams, createSession, hasSetInitialModelCardId]);

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
    // FIX: Always pass current model_card_id when creating new session
    // This ensures the new session is associated with the current assistant
    let modelCardId = currentSession?.model_card_id;
    
    // Fallback: If no current session or no model_card_id, use first available model card
    if (!modelCardId && modelCards.length > 0) {
      console.warn('[NewSession] No model_card_id in current session, using first available model card:', modelCards[0].name);
      modelCardId = modelCards[0].id;
    }
    
    if (!modelCardId) {
      console.error('[NewSession] Cannot create session: no model cards available');
      message.warning('请先配置至少一个助手');
      return;
    }
    
    createSession(undefined, modelCardId);
  }, [createSession, currentSession?.model_card_id, modelCards]);

  const handleSessionRename = useCallback(
    async (sessionId: string, newName: string) => {
      console.log('[SessionRename] Renaming session:', sessionId, 'to:', newName);

      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      // Update local state first
      updateSession(sessionId, { name: newName });

      // If session has conversation_id, update backend as well
      if (session.conversation_id) {
        try {
          // FIX: Add Authorization header with beta token from URL
          const authToken = searchParams.get('auth');
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
          };
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
          }

          const response = await fetch('/v1/conversation/set', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              conversation_id: session.conversation_id,
              is_new: false,
              name: newName,
            }),
          });

          const result = await response.json();
          if (result.code !== 0) {
            console.error('[SessionRename] Backend update failed:', result.message);
          }
        } catch (error) {
          console.error('[SessionRename] Failed to update conversation name in backend:', error);
        }
      }

      // Save to FreeChatUserSettings
      setTimeout(() => {
        console.log('[SessionRename] Triggering immediate save via manualSave');
        manualSave();
      }, 50);
    },
    [sessions, updateSession, manualSave, searchParams],
  );

  const handleSessionDelete = useCallback(
    async (sessionId: string) => {
      console.log('[handleSessionDelete] Deleting session:', sessionId);
      // FIX: Delegate all deletion logic to deleteSession mutation
      // It will handle both draft (local) and active (backend) sessions
      deleteSession(sessionId);
    },
    [deleteSession],
  );

  const handleModelCardChange = useCallback(
    (newModelCardId: number) => {
      // FIX: Delete any existing draft sessions before creating new one
      const draftSession = sessions.find(s => s.state === 'draft');
      if (draftSession) {
        console.log('[ModelCardChange] Deleting existing draft:', draftSession.id);
        deleteSession(draftSession.id);
      }
      
      // Create draft session (local only, not persisted to backend)
      // Draft will be promoted to active when user sends first message
      console.log('[ModelCardChange] Creating new draft for model card:', newModelCardId);
      createSession('新对话', newModelCardId, true);  // isDraft=true
    },
    [createSession, deleteSession, sessions],
  );

  const handleRolePromptChange = useCallback(
    (prompt: string) => {
      // Save role_prompt to current session instead of global settings
      if (currentSession) {
        updateSession(currentSession.id, {
          params: {
            ...currentSession.params,
            role_prompt: prompt,
          },
        });
      }
    },
    [currentSession, updateSession],
  );

  const handleModelParamsChange = useCallback(
    (params: any) => {
      // Save params to current session instead of global settings
      if (currentSession) {
        updateSession(currentSession.id, {
          params: {
            ...currentSession.params,
            ...params,
          },
        });
      }
    },
    [currentSession, updateSession],
  );

  // Calculate effective model params for current session
  // Priority: session.params > modelCard.params > system defaults
  const effectiveModelParams = useMemo(() => {
    const defaults = { temperature: 0.7, top_p: 0.9 };
    const modelCardParams = currentModelCard ? {
      temperature: currentModelCard.temperature,
      top_p: currentModelCard.top_p,
    } : {};
    const sessionParams = currentSession?.params || {};

    return {
      ...defaults,
      ...modelCardParams,
      ...sessionParams,
    };
  }, [currentSession, currentModelCard]);

  // Calculate effective role prompt
  // Priority: session.params.role_prompt > modelCard.prompt > empty string
  const effectiveRolePrompt = useMemo(() => {
    return currentSession?.params?.role_prompt || currentModelCard?.prompt || '';
  }, [currentSession, currentModelCard]);

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
    <div className="flex h-screen bg-background relative">
      {/* Left Sidebar - Dual Tabs */}
      <SidebarDualTabs
        sessions={sessions}
        currentSessionId={currentSessionId}
        currentModelCardId={currentSession?.model_card_id}
        onSessionSelect={switchSession}
        onModelCardSelect={handleModelCardChange}
        onNewSession={handleNewSession}
        onSessionRename={handleSessionRename}
        onSessionDelete={handleSessionDelete}
        userId={userId}
        currentUserInfo={currentUserInfo}
        userInfo={userInfo}
        tenantInfo={displayTenantInfo}
      />

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatInterface
          messages={derivedMessages}
          sendLoading={sendLoading}
          scrollRef={scrollRef}
          messageContainerRef={messageContainerRef}
          removeMessageById={removeMessageById}
          removeAllMessages={removeAllMessages}
          regenerateMessage={regenerateMessage}
          dialogId={dialogId}
          userAvatar={userAvatar}
          userNickname={userNickname}
          dialogAvatar={dialogAvatar}
          sessionName={currentSession?.name}
          modelCardName={currentModelCard?.name}
          isSettingsPanelOpen={isSettingsPanelOpen}
          onToggleSettingsPanel={() => setIsSettingsPanelOpen(!isSettingsPanelOpen)}
        />

        {/* Simplified Input - replacing NextMessageInput */}
        <SimplifiedMessageInput
          value={value}
          onChange={handleInputChange}
          onSend={handlePressEnter}
          onNewTopic={handleNewSession}
          onClearMessages={removeAllMessages}
          disabled={!currentSession?.model_card_id}
          sendLoading={sendLoading}
        />
      </div>

      {/* Control Panel - Right Side (Collapsible) */}
      {isSettingsPanelOpen && (
        <div className="w-96 border-l flex-shrink-0">
          <ControlPanel
            currentModelCard={currentModelCard || undefined}
            rolePrompt={effectiveRolePrompt}
            onRolePromptChange={handleRolePromptChange}
            modelParams={effectiveModelParams}
            onModelParamsChange={handleModelParamsChange}
            saving={settingsSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            onManualSave={manualSave}
          />
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
        <KBProvider>
          <FreeChatContent />
        </KBProvider>
      </div>
    </>
  );
}
