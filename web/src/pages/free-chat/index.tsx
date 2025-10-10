import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// XState Integration: Use state machine for seamless Draft→Active transitions
import { useFetchDialogList } from '@/hooks/use-chat-request';
import {
  useFetchTenantInfo,
  useListTenantUser,
} from '@/hooks/user-setting-hooks';
import i18n from '@/locales/config';
import chatService from '@/services/next-chat-service';
import api from '@/utils/api';
import { useQuery } from '@tanstack/react-query';
import { Spin, message } from 'antd';
import { Helmet, useSearchParams } from 'umi';
import { ChatInterface } from './chat-interface';
import { ControlPanel } from './components/control-panel';
import { SidebarDualTabs } from './components/sidebar-dual-tabs';
import { SimplifiedMessageInput } from './components/simplified-message-input';
import { KBProvider } from './contexts/kb-context';
import { useFetchModelCards } from './hooks/use-fetch-model-cards';
import { useFreeChatSettingsApi } from './hooks/use-free-chat-settings-api';
import { useFreeChatUserId } from './hooks/use-free-chat-user-id';
import { useFreeChatWithMachine } from './hooks/use-free-chat-with-machine';

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
          Authorization: `Bearer ${searchParams.get('auth')}` || '',
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
        zhcn: 'zh',
        zhtw: 'zh-TRADITIONAL',
        en: 'en',
      };
      const language =
        languageMap[languageParam.toLowerCase()] || languageParam;
      i18n.changeLanguage(language);
    }
  }, [searchParams]);

  // Find current user info from tenant users
  const currentUserInfo = Array.isArray(tenantUsers)
    ? tenantUsers.find((user) => user.user_id === userId)
    : undefined;

  // Determine which team info to display
  // If user is found in tenantUsers, they are a NORMAL member -> show joined team (tenantInfo)
  // If user is NOT in tenantUsers, they are the OWNER -> show their own team (tenantInfo is already correct)
  const displayTenantInfo = tenantInfo;

  // FIX: Removed handleSessionsChange callback
  // Sessions are now managed by TanStack Query (auto-synced with backend)
  // No need to manually save to FreeChatUserSettings.sessions

  // XState Integration: Enhanced hook with state machine for Draft→Active transitions
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
    updateSession,
    toggleFavorite,
    deleteUnfavorited,
    getOrCreateDraftForCard,
    resetDraft,
    dialogId,
    setDialogId,
    // XState: New state indicators
    isDraft,
    isPromoting,
    isActive,
  } = useFreeChatWithMachine(controller.current, userId, settings, updateField);

  // Find current dialog by dialogId
  const currentDialog = useMemo(() => {
    return dialogData?.dialogs?.find((d) => d.id === dialogId);
  }, [dialogData, dialogId]);

  // Get current session and model card
  const currentSession = sessions?.find((s) => s.id === currentSessionId);
  const currentModelCard = useMemo(() => {
    if (!currentSession?.model_card_id) return null;
    return modelCards?.find((c) => c.id === currentSession.model_card_id);
  }, [currentSession, modelCards]);

  // Calculate user avatar and nickname
  // Priority: userInfo (from /user/info?user_id=xxx) > currentUserInfo (from tenant users list)
  const userAvatar = userInfo?.avatar || currentUserInfo?.avatar;
  const userNickname =
    userInfo?.nickname ||
    userInfo?.email ||
    currentUserInfo?.nickname ||
    currentUserInfo?.email ||
    'User';
  const dialogAvatar = currentDialog?.icon; // Use dialog icon if set, otherwise MessageItem will show default AssistantIcon

  const [loadedConversationId, setLoadedConversationId] = useState<string>('');
  const [hasSetInitialDialogId, setHasSetInitialDialogId] = useState(false);
  const [hasSetInitialModelCardId, setHasSetInitialModelCardId] =
    useState(false);

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
  }, [
    searchParams,
    dialogId,
    setDialogId,
    userId,
    settings,
    updateField,
    hasSetInitialDialogId,
  ]);

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

    // Check if session with this conversation_id already exists
    const existingSession = sessions.find(
      (s) => s.conversation_id === conversationId,
    );
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
          true,
        );

        // Check if this effect was cancelled (e.g., conversation_id changed)
        if (isCancelled) return;

        if (data.code === 0 && data.data) {
          const conversation = data.data;

          // This is an existing conversation from backend
          // We need to add it to our sessions store manually
          // Note: This is a rare case (URL parameter loading)
          updateSession(conversationId, {
            conversation_id: conversationId,
            name: conversation.name || 'Chat from conversation',
            messages: conversation.message || [],
            state: 'active',
          });

          // Switch to this session
          switchSession(conversationId);
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
  }, [
    searchParams,
    loadedConversationId,
    switchSession,
    updateSession,
    sessions,
  ]);

  const handleNewSession = useCallback(() => {
    // Get or create draft for current model card
    let modelCardId = currentSession?.model_card_id;

    // Fallback: If no current session or no model_card_id, use first available model card
    if (!modelCardId && modelCards.length > 0) {
      console.warn(
        '[NewSession] No model_card_id in current session, using first available model card:',
        modelCards[0].name,
      );
      modelCardId = modelCards[0].id;
    }

    if (!modelCardId) {
      console.error(
        '[NewSession] Cannot create session: no model cards available',
      );
      message.warning('请先配置至少一个助手');
      return;
    }

    // Get or create the permanent draft for this model card
    const draft = getOrCreateDraftForCard(modelCardId);

    // Switch to this draft
    switchSession(draft.id);
  }, [
    getOrCreateDraftForCard,
    switchSession,
    currentSession?.model_card_id,
    modelCards,
  ]);

  const handleSessionRename = useCallback(
    async (sessionId: string, newName: string) => {
      console.log(
        '[SessionRename] Renaming session:',
        sessionId,
        'to:',
        newName,
      );

      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      // Save old name for rollback
      const oldName = session.name;

      // FIX: Optimistic update with rollback on failure
      updateSession(sessionId, { name: newName });

      // If session has conversation_id, update backend as well
      if (session.conversation_id) {
        try {
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
            console.error(
              '[SessionRename] Backend update failed:',
              result.message,
            );
            // FIX: Rollback on backend failure
            updateSession(sessionId, { name: oldName });
            message.error(`重命名失败: ${result.message}`);
            return;
          }
        } catch (error) {
          console.error('[SessionRename] Network error:', error);
          // FIX: Rollback on network error
          updateSession(sessionId, { name: oldName });
          message.error('网络错误，重命名失败');
          return;
        }
      }

      // Save to FreeChatUserSettings only on success
      setTimeout(() => {
        manualSave();
      }, 50);
    },
    [sessions, updateSession, manualSave, searchParams],
  );

  const handleSessionDelete = useCallback(
    async (sessionId: string) => {
      console.log('[handleSessionDelete] Deleting session:', sessionId);

      // Find the session
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      // For active sessions, call backend to delete
      if (session.conversation_id) {
        try {
          const authToken = searchParams.get('auth');
          const response = await fetch('/v1/conversation/rm', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
            credentials: 'include',
            body: JSON.stringify({
              conversation_ids: [session.conversation_id],
            }),
          });

          const result = await response.json();
          if (result.code !== 0) {
            message.error(`删除失败: ${result.message}`);
            return;
          }
        } catch (error) {
          message.error('网络错误，删除失败');
          return;
        }
      }

      // Remove from local store (for both draft and active)
      // Note: We can't truly "delete" a draft - it's permanent per card
      // So we just switch away from it
      const remainingSessions = sessions.filter((s) => s.id !== sessionId);
      if (remainingSessions.length > 0) {
        switchSession(remainingSessions[0].id);
      }
    },
    [sessions, switchSession, searchParams],
  );

  // CRITICAL: Each model card has ONE and ONLY ONE permanent draft
  const handleModelCardChange = useCallback(
    (newModelCardId: number) => {
      // Get or create the permanent draft for this model card
      const draft = getOrCreateDraftForCard(newModelCardId);

      // Switch to this draft
      switchSession(draft.id);

      console.log(
        '[ModelCardChange] Switched to draft for card:',
        newModelCardId,
        'draftId:',
        draft.id,
      );
    },
    [getOrCreateDraftForCard, switchSession],
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
    const modelCardParams = currentModelCard
      ? {
          temperature: currentModelCard.temperature,
          top_p: currentModelCard.top_p,
        }
      : {};
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
    return (
      currentSession?.params?.role_prompt || currentModelCard?.prompt || ''
    );
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
          <p className="text-muted-foreground">
            This page requires a user_id parameter to access.
          </p>
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
        onToggleFavorite={toggleFavorite}
        onDeleteUnfavorited={deleteUnfavorited}
        userId={userId}
        currentUserInfo={currentUserInfo}
        userInfo={userInfo}
        tenantInfo={displayTenantInfo}
      />

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* XState: Promotion indicator - shows when Draft is being promoted to Active */}
        {isPromoting && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2">
            <Spin size="small" />
            <span className="text-sm text-blue-700">正在创建对话...</span>
          </div>
        )}

        <ChatInterface
          messages={derivedMessages}
          sendLoading={sendLoading || isPromoting}
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
          onToggleSettingsPanel={() =>
            setIsSettingsPanelOpen(!isSettingsPanelOpen)
          }
        />

        {/* Simplified Input - replacing NextMessageInput */}
        <SimplifiedMessageInput
          value={value}
          onChange={handleInputChange}
          onSend={handlePressEnter}
          onNewTopic={handleNewSession}
          onClearMessages={removeAllMessages}
          disabled={!currentSession?.model_card_id || isPromoting}
          sendLoading={sendLoading || isPromoting}
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
    link.href =
      'https://chinese-fonts-cdn.deno.dev/packages/jhlst/dist/%E4%BA%AC%E8%8F%AF%E8%80%81%E5%AE%8B%E4%BD%93v1_007/result.css';
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
