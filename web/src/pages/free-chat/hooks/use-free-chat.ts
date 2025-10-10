import { MessageType } from '@/constants/chat';
import { useTranslate } from '@/hooks/common-hooks';
import {
  useHandleMessageInputChange,
  useSelectDerivedMessages,
  useSendMessageWithSse,
} from '@/hooks/logic-hooks';
import { useUpdateConversation } from '@/hooks/use-chat-request';
import { Message } from '@/interfaces/database/chat';
import api from '@/utils/api';
import { debounce, trim } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  ERROR_MESSAGES,
  MESSAGE_SYNC_DEBOUNCE_MS,
  SESSION_STATE,
  SYNC_CLEANUP_DELAY_MS,
} from '../constants';
import { useKBContext } from '../contexts/kb-context';
import { DynamicModelParams } from '../types';
import { logError } from '../utils/error-handler';
import { useFreeChatSession } from './use-free-chat-session';

interface UseFreeChatProps {
  userId: string;
  settings: any; // FreeChatSettings from API
}

export const useFreeChat = (
  controller: AbortController,
  userId?: string,
  settings?: UseFreeChatProps['settings'],
) => {
  const { t } = useTranslate('chat');

  const { enabledKBs } = useKBContext();
  const { handleInputChange, value, setValue } = useHandleMessageInputChange();
  const { updateConversation } = useUpdateConversation();

  // Initialize dialogId from settings
  const [dialogId, setDialogId] = useState<string>(settings?.dialog_id || '');

  // Sync dialogId from settings
  useEffect(() => {
    if (settings?.dialog_id) {
      setDialogId(settings.dialog_id);
    }
  }, [settings?.dialog_id]);

  // Use Zustand Store for session management
  const {
    currentSession,
    currentSessionId,
    createSession,
    updateSession,
    sessions,
    switchSession,
    deleteSession,
    clearAllSessions,
    toggleFavorite,
    deleteUnfavorited,
    getOrCreateDraftForCard,
    resetDraft,
  } = useFreeChatSession({
    initialSessions: settings?.sessions,
    onSessionsChange: (sessions) => {
      // 会话变化时的回调，可以在这里保存到后端
      // 这个回调会传递到index.tsx中的updateField
    },
  });

  // SSE sending logic
  const { send, answer, done } = useSendMessageWithSse(
    api.completeConversation,
  );

  const {
    scrollRef,
    messageContainerRef,
    derivedMessages,
    setDerivedMessages,
    addNewestAnswer,
    addNewestQuestion,
    removeLatestMessage,
    removeMessageById,
    removeAllMessages,
  } = useSelectDerivedMessages();

  // BUG FIX #10 & CRITICAL FIX: Force refresh messages when switching sessions
  // Use ref to track last loaded session to prevent unnecessary reloads
  const lastLoadedSessionIdRef = useRef<string>('');

  useEffect(() => {
    // Only reload if session ID actually changed
    if (lastLoadedSessionIdRef.current === currentSessionId) {
      return;
    }

    console.log(
      '[MessageSync] Session ID changed from',
      lastLoadedSessionIdRef.current,
      'to',
      currentSessionId,
    );
    lastLoadedSessionIdRef.current = currentSessionId;

    if (!currentSessionId) {
      console.log('[MessageSync] No session selected, clearing messages');
      setDerivedMessages([]);
      return;
    }

    // Find session from sessions array
    const session = sessions.find((s) => s.id === currentSessionId);

    if (session) {
      const newMessages = session.messages || [];
      console.log(
        '[MessageSync] Loading session:',
        session.name,
        'state:',
        session.state,
        'messages:',
        newMessages.length,
      );
      setDerivedMessages(newMessages);
    } else {
      console.warn(
        '[MessageSync] Session not found in cache:',
        currentSessionId,
      );
      setDerivedMessages([]);
    }
  }, [currentSessionId, sessions, setDerivedMessages]);

  // Stop output
  const stopOutputMessage = useCallback(() => {
    controller.abort();
  }, [controller]);

  // FIX: Use ref to avoid stale closure in callbacks
  const currentSessionRef = useRef(currentSession);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // Send message (core logic)
  const sendMessage = useCallback(
    async (message: Message, customParams?: DynamicModelParams) => {
      if (!dialogId) {
        logError(
          ERROR_MESSAGES.NO_DIALOG_ID,
          'useFreeChat.sendMessage',
          true,
          t('noDialogIdError'),
        );
        return;
      }

      // Use ref to get latest currentSession
      const session = currentSessionRef.current;
      let conversationId = session?.conversation_id;

      // Create conversation if not exists
      if (!conversationId) {
        // FIX: Ensure model_card_id exists before creating conversation
        // Without model_card_id, backend cannot apply model card parameters
        if (!session?.model_card_id) {
          logError(
            'Please select an assistant first',
            'useFreeChat.sendMessage',
            true,
            t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手'),
          );
          removeLatestMessage();
          return;
        }

        // Use session name if user renamed it (not the default "新对话"), otherwise use message content
        const conversationName =
          session.name && session.name !== '新对话'
            ? session.name
            : message.content.slice(0, 50);

        const convData = await updateConversation({
          dialog_id: dialogId,
          name: conversationName,
          is_new: true,
          model_card_id: session.model_card_id, // Add model_card_id
          message: [
            {
              role: MessageType.Assistant,
              content: '',
            },
          ],
        });

        if (convData.code === 0) {
          conversationId = convData.data.id;

          // FIX: Draft → Active promotion (reset draft, create new active)
          // CRITICAL: Each model card has ONE permanent draft that gets reset, not deleted
          if (session) {
            const draftId = session.id;
            const draftModelCardId = session.model_card_id;
            const draftParams = session.params;
            const currentMessages = [...derivedMessages];

            // 1. Reset Draft to initial state (permanent draft stays in store)
            resetDraft(draftId);

            // 2. Create Active with backend ID
            const newActiveSession = createSession(
              conversationName,
              draftModelCardId,
              false, // isDraft = false
              conversationId, // Use backend-generated ID
            );

            // 3. Restore params and messages to Active
            if (draftParams && newActiveSession) {
              updateSession(conversationId, { params: draftParams });
            }
            updateSession(conversationId, { messages: currentMessages });

            console.log('[SendMessage] Draft→Active promotion:', {
              draftId,
              activeId: conversationId,
              modelCardId: draftModelCardId,
            });
          }
        } else {
          logError(
            t('failedToCreateConversation'),
            'useFreeChat.sendMessage',
            true,
            t('failedToCreateConversation'),
          );
          removeLatestMessage();
          return;
        }
      }

      // FIX: Ensure model_card_id exists before sending message
      // This check prevents sending messages without an associated assistant
      if (!session?.model_card_id) {
        logError(
          'Please select an assistant first',
          'useFreeChat.sendMessage',
          true,
          t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手'),
        );
        removeLatestMessage();
        return;
      }

      // BUG FIX #7 & #12: Ensure kb_ids from enabledKBs has priority over params
      // Use session.params for conversation-level parameter overrides
      // Backend will merge: conversation params > model card params > bot defaults
      const baseParams = customParams || session.params || {};
      const kbIdsArray = Array.from(enabledKBs);

      const requestBody = {
        conversation_id: conversationId,
        messages: [...derivedMessages, message],
        // Dynamic parameters from session (temperature, top_p)
        ...(baseParams.temperature !== undefined && {
          temperature: baseParams.temperature,
        }),
        ...(baseParams.top_p !== undefined && { top_p: baseParams.top_p }),
        // Model card ID (REQUIRED - for parameter merging on backend)
        // Type assertion: we've already validated model_card_id exists above
        model_card_id: session.model_card_id!,
        // Dynamic knowledge base (always include, overrides any kb_ids in params)
        kb_ids: kbIdsArray,
        // Dynamic role prompt from session (system prompt override)
        ...(baseParams.role_prompt !== undefined && {
          role_prompt: baseParams.role_prompt,
        }),
      };

      const res = await send(requestBody, controller);

      if (res && (res?.response.status !== 200 || res?.data?.code !== 0)) {
        setValue(message.content);
        removeLatestMessage();
      }
      // STEP 3 FIX: Removed refetchSessions call
      // Messages are already persisted by completion API
      // createSession mutation auto-updates cache
      // BUG FIX #1: Remove duplicate session update here
      // The session will be updated by the derivedMessages sync effect
    },
    [
      dialogId,
      derivedMessages,
      enabledKBs,
      send,
      controller,
      setValue,
      removeLatestMessage,
      updateConversation,
      updateSession,
      deleteSession,
      createSession,
      t,
    ],
  );

  // FIX: Add validation to handlePressEnter before sending
  // Press Enter to send
  const handlePressEnter = useCallback(() => {
    if (trim(value) === '') return;
    if (!done) return;

    // Validate model_card_id before sending - use ref to get latest value
    const session = currentSessionRef.current;
    console.log('[handlePressEnter] Validation check:', {
      hasSession: !!session,
      sessionId: session?.id,
      model_card_id: session?.model_card_id,
      state: session?.state,
    });

    if (!session?.model_card_id) {
      logError(
        'Please select an assistant first',
        'useFreeChat.handlePressEnter',
        true,
        t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手'),
      );
      return;
    }

    const message: Message = {
      id: uuid(),
      role: MessageType.User,
      content: value,
    };

    addNewestQuestion(message);
    setValue('');
    sendMessage(message);
  }, [value, done, addNewestQuestion, setValue, sendMessage, t]);

  // FIX: Regenerate answer with proper error handling and session params
  // Prevents message loss when regeneration fails
  const regenerateMessage = useCallback(
    async (message: Message) => {
      // Validate model_card_id before attempting regeneration - use ref
      const session = currentSessionRef.current;
      if (!session?.model_card_id) {
        logError(
          'Cannot regenerate: no assistant selected',
          'useFreeChat.regenerateMessage',
          true,
          t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手'),
        );
        return; // Don't delete messages, just return
      }

      if (message.id) {
        const index = derivedMessages.findIndex((x) => x.id === message.id);
        if (index !== -1) {
          // Save original messages for rollback on failure
          const originalMessages = [...derivedMessages];
          const newMessages = derivedMessages.slice(0, index + 1);
          setDerivedMessages(newMessages);

          try {
            // FIX: Pass session.params to maintain user's temperature/top_p settings
            await sendMessage(message, session.params);
          } catch (error) {
            // Rollback to original messages on failure
            setDerivedMessages(originalMessages);
            logError(
              'Failed to regenerate message',
              'useFreeChat.regenerateMessage',
              true,
              error instanceof Error
                ? error.message
                : t('unknownError', '未知错误'),
            );
          }
        }
      }
    },
    [derivedMessages, setDerivedMessages, sendMessage, t],
  );

  // Listen to answer updates
  useEffect(() => {
    if (answer.answer) {
      addNewestAnswer(answer);
    }
  }, [answer, addNewestAnswer]);

  // BUG FIX #1, #9 & #13: Properly sync derivedMessages to session storage
  // Use refs to avoid circular dependency issues
  const currentSessionIdRef = useRef(currentSessionId);
  const sessionsRef = useRef(sessions);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    currentSessionIdRef.current = currentSession;
  }, [currentSession]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // FIX: Add debounced update to prevent frequent localStorage writes
  const debouncedUpdateSession = useMemo(
    () =>
      debounce((id: string, updates: any) => {
        updateSession(id, updates);
      }, MESSAGE_SYNC_DEBOUNCE_MS),
    [updateSession],
  );

  // BUG FIX: Sync messages to session (including empty arrays for delete all)
  useEffect(() => {
    const session = currentSessionRef.current;
    const sessionId = session?.id;

    // CRITICAL: Don't sync if no session or syncing is in progress
    if (!sessionId || isSyncingRef.current) {
      return;
    }

    // FIX: Remove empty check to allow syncing empty messages (delete all scenario)
    // Previously: if (derivedMessages.length === 0) return;
    // This prevented clearing messages from being persisted

    // CRITICAL FIX: NEVER sync messages back to draft sessions
    // Draft should remain empty until promoted to active
    // Draft messages are only created during conversation, not loaded from anywhere
    if (session.state === SESSION_STATE.DRAFT) {
      return;
    }

    const currentMessages = session.messages || [];

    // Check if messages actually changed (including empty array case)
    const messagesChanged =
      derivedMessages.length !== currentMessages.length ||
      derivedMessages.some((msg, idx) => {
        const current = currentMessages[idx];
        return (
          !current || msg.id !== current.id || msg.content !== current.content
        );
      });

    if (messagesChanged) {
      isSyncingRef.current = true;
      // FIX: Use debounced update to prevent frequent localStorage writes
      debouncedUpdateSession(sessionId, {
        messages: derivedMessages,
      });
      // Schedule reset after debounce time + small buffer
      setTimeout(() => {
        isSyncingRef.current = false;
      }, SYNC_CLEANUP_DELAY_MS);
    }
  }, [derivedMessages, debouncedUpdateSession]); // BUG FIX: Remove sessions dependency to avoid circular updates

  return {
    // Message related
    handlePressEnter,
    handleInputChange,
    value,
    setValue,
    derivedMessages,
    removeMessageById,
    removeAllMessages,
    regenerateMessage,

    // Status
    sendLoading: !done,
    scrollRef,
    messageContainerRef,
    stopOutputMessage,

    // Session management
    currentSession,
    currentSessionId,
    sessions,
    createSession,
    updateSession,
    switchSession,
    deleteSession,
    clearAllSessions,
    toggleFavorite,
    deleteUnfavorited,
    getOrCreateDraftForCard,
    resetDraft,

    // Dialog ID
    dialogId,
    setDialogId,
  };
};
