/**
 * useFreeChat with Simplified State Management (Refactored)
 *
 * ✅ Refactored (2025-01-11):
 * - REMOVED XState complexity - now uses pure Zustand
 * - REMOVED polling anti-pattern (was: while (!conversationId) loop)
 * - State-driven UI (if promoting → show loading, if active → enable chat)
 * - Single source of truth (Zustand for all data and state)
 * - Proper async flow (no manual waiting, Zustand store handles transitions)
 *
 * CRITICAL FEATURE: Messages stay visible during Draft→Active transition
 * - User sends message in draft
 * - derivedMessages keeps the message visible in chat interface
 * - Store's promoteToActive action handles backend promotion (automatic)
 * - UI updates driven by store state, not polling
 * - Chat interface NEVER refreshes
 */

import { MessageType } from '@/constants/chat';
import { useTranslate } from '@/hooks/common-hooks';
import {
  useHandleMessageInputChange,
  useSelectDerivedMessages,
  useSendMessageWithSse,
} from '@/hooks/logic-hooks';
import { Message } from '@/interfaces/database/chat';
import api from '@/utils/api';
import { trim } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ERROR_MESSAGES, SESSION_STATE } from '../constants';
import { useKBContext } from '../contexts/kb-context';
import { DynamicModelParams } from '../types';
import { logError } from '../utils/error-handler';
import { useFreeChatSession } from './use-free-chat-session';
import { useSessionMachine } from './use-session-machine';

export const useFreeChatWithMachine = (
  controller: AbortController,
  userId?: string,
  settings?: any,
  updateField?: (
    field: string,
    value: any,
    options?: { silent?: boolean; immediate?: boolean },
  ) => void,
) => {
  const { t } = useTranslate('chat');
  const { enabledKBs } = useKBContext();
  const { handleInputChange, value, setValue } = useHandleMessageInputChange();

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
    sessions,
    createSession,
    switchSession,
    updateSession,
    getOrCreateDraftForCard,
    resetDraft,
    ...sessionActions
  } = useFreeChatSession({
    initialSessions: settings?.sessions,
    onSessionsChange: useCallback(
      (activeSessions) => {
        // ✅ Sync active sessions to settings (triggers auto-save)
        if (updateField && activeSessions.length > 0) {
          console.log(
            '[useFreeChatWithMachine] Syncing',
            activeSessions.length,
            'active sessions to settings',
          );
          updateField('sessions', activeSessions, { silent: true });
        }
      },
      [updateField],
    ),
  });

  // ✅ Store pending message during promotion
  const pendingMessageRef = useRef<Message | null>(null);

  // ✅ Simplified: Session state hook (no XState, pure Zustand)
  const { isDraft, isPromoting, isActive, promoteToActive, promotionError } =
    useSessionMachine({
      sessionId: currentSessionId,
      onPromotionSuccess: async (conversationId) => {
        console.log('[useSessionMachine] Promotion succeeded:', conversationId);

        // ✅ FIX: Send the pending message directly using the returned conversationId
        if (pendingMessageRef.current) {
          console.log(
            '[useSessionMachine] Sending pending message after promotion',
          );
          const pendingMessage = pendingMessageRef.current;
          pendingMessageRef.current = null; // Clear pending message

          // Get session from store to get model_card_id
          const session = currentSessionRef.current;
          if (!session || !session.model_card_id) {
            console.error(
              '[useSessionMachine] Session or model_card_id missing after promotion',
            );
            return;
          }

          // Send message directly using the conversationId we just got
          const baseParams = session.params || {};
          const kbIdsArray = Array.from(enabledKBs);

          const requestBody = {
            conversation_id: conversationId, // ✅ Use the new conversationId directly!
            messages: [...derivedMessages, pendingMessage],
            model_card_id: session.model_card_id,
            kb_ids: kbIdsArray,
            ...(baseParams.temperature !== undefined && {
              temperature: baseParams.temperature,
            }),
            ...(baseParams.top_p !== undefined && { top_p: baseParams.top_p }),
          };

          console.log('[useSessionMachine] Sending to LLM:', {
            conversationId,
            messageCount: requestBody.messages.length,
          });

          const res = await send(requestBody, controller);

          if (res && (res?.response.status !== 200 || res?.data?.code !== 0)) {
            setValue(pendingMessage.content);
            removeLatestMessage();
          }
        }
      },
      onPromotionFailure: (error) => {
        console.error('[useSessionMachine] Promotion failed:', error);

        // ✅ Clear pending message on failure
        pendingMessageRef.current = null;

        logError(
          'Failed to create conversation',
          'useFreeChatWithMachine.onPromotionFailure',
          true,
          error.message,
        );
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

  // ========== Message Sync: Session → derivedMessages ==========

  const lastLoadedSessionIdRef = useRef<string>('');

  useEffect(() => {
    // Only reload if session ID actually changed
    if (lastLoadedSessionIdRef.current === currentSessionId) {
      return;
    }

    lastLoadedSessionIdRef.current = currentSessionId;

    if (!currentSessionId) {
      setDerivedMessages([]);
      return;
    }

    // Find session from sessions array
    const session = sessions.find((s) => s.id === currentSessionId);

    if (session) {
      const newMessages = session.messages || [];
      setDerivedMessages(newMessages);
    } else {
      setDerivedMessages([]);
    }
  }, [currentSessionId, sessions, setDerivedMessages]);

  // Stop output
  const stopOutputMessage = useCallback(() => {
    controller.abort();
  }, [controller]);

  // Use ref to avoid stale closure in callbacks
  const currentSessionRef = useRef(currentSession);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // ========== ✅ CRITICAL: Send Message (NO POLLING) ==========

  /**
   * ✅ BEST PRACTICE: State-driven message sending
   *
   * FLOW:
   * 1. User types message and presses Enter
   * 2. Message added to derivedMessages (visible immediately)
   * 3. If Draft: Trigger promotion, DON'T wait (return early)
   *    - Machine transitions to 'promoting' → UI shows loading
   *    - When done, machine→'active' → handlePressEnter will be called again by user
   * 4. If Active: Send message directly via SSE
   *
   * NO POLLING! State machine handles async flow.
   */
  const sendMessage = useCallback(
    async (message: Message, customParams?: DynamicModelParams) => {
      if (!dialogId) {
        logError(
          ERROR_MESSAGES.NO_DIALOG_ID,
          'useFreeChatWithMachine.sendMessage',
          true,
          t('noDialogIdError'),
        );
        return;
      }

      const session = currentSessionRef.current;

      // Validate model_card_id
      if (!session?.model_card_id) {
        logError(
          ERROR_MESSAGES.NO_ASSISTANT_SELECTED,
          'useFreeChatWithMachine.sendMessage',
          true,
          t('pleaseSelectAssistant'),
        );
        removeLatestMessage();
        return;
      }

      // ========== ✅ DRAFT PROMOTION (NO WAITING) ==========
      if (isDraft && !session.conversation_id) {
        console.log(
          '[sendMessage] Draft detected, triggering promotion (not waiting)',
        );

        // ✅ Store message for later sending after promotion
        pendingMessageRef.current = message;

        // ✅ Trigger promotion
        // onPromotionSuccess will re-send the message after conversation is created
        promoteToActive(message, dialogId, userId);

        // DON'T send message yet - wait for promotion to complete
        // User will see loading indicator (driven by isPromoting state)
        return;
      }

      // ========== ✅ SEND MESSAGE (Active sessions only) ==========

      const conversationId = session.conversation_id;

      if (!conversationId) {
        // Should not happen if state machine works correctly
        logError(
          'No conversation_id available',
          'useFreeChatWithMachine.sendMessage',
          true,
          t('noConversationId'),
        );
        removeLatestMessage();
        return;
      }

      console.log('[sendMessage] Sending to conversation:', conversationId);

      const baseParams = customParams || session.params || {};
      const kbIdsArray = Array.from(enabledKBs);

      const requestBody = {
        conversation_id: conversationId,
        messages: [...derivedMessages, message],
        model_card_id: session.model_card_id!,
        kb_ids: kbIdsArray,
        ...(baseParams.temperature !== undefined && {
          temperature: baseParams.temperature,
        }),
        ...(baseParams.top_p !== undefined && { top_p: baseParams.top_p }),
      };

      const res = await send(requestBody, controller);

      if (res && (res?.response.status !== 200 || res?.data?.code !== 0)) {
        setValue(message.content);
        removeLatestMessage();
      }
    },
    [
      dialogId,
      isDraft,
      derivedMessages,
      enabledKBs,
      send,
      controller,
      setValue,
      removeLatestMessage,
      promoteToActive,
      t,
    ],
  );

  // ========== Press Enter to Send ==========

  const handlePressEnter = useCallback(() => {
    if (trim(value) === '') return;
    if (!done) return;

    const session = currentSessionRef.current;

    if (!session?.model_card_id) {
      logError(
        ERROR_MESSAGES.NO_ASSISTANT_SELECTED,
        'useFreeChatWithMachine.handlePressEnter',
        true,
        t('pleaseSelectAssistant'),
      );
      return;
    }

    const message: Message = {
      id: uuid(),
      role: MessageType.User,
      content: value,
    };

    // Add message to chat interface (visible immediately)
    addNewestQuestion(message);
    setValue('');

    // Send message (with potential Draft→Active promotion)
    sendMessage(message);
  }, [value, done, addNewestQuestion, setValue, sendMessage, t]);

  // ========== Regenerate Message ==========

  const regenerateMessage = useCallback(
    async (message: Message) => {
      const session = currentSessionRef.current;
      if (!session?.model_card_id) {
        logError(
          'Cannot regenerate: no assistant selected',
          'useFreeChatWithMachine.regenerateMessage',
          true,
          t('pleaseSelectAssistant'),
        );
        return;
      }

      if (message.id) {
        const index = derivedMessages.findIndex((x) => x.id === message.id);
        if (index !== -1) {
          const originalMessages = [...derivedMessages];
          const newMessages = derivedMessages.slice(0, index + 1);
          setDerivedMessages(newMessages);

          try {
            await sendMessage(message, session.params);
          } catch (error) {
            setDerivedMessages(originalMessages);
            logError(
              'Failed to regenerate message',
              'useFreeChatWithMachine.regenerateMessage',
              true,
              error instanceof Error ? error.message : t('unknownError'),
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

  // ========== Message Sync: derivedMessages → Session ==========
  // (Keep existing sync logic but skip if promoting)

  const sessionsRef = useRef(sessions);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    const session = currentSessionRef.current;
    const sessionId = session?.id;

    if (!sessionId || isSyncingRef.current) {
      return;
    }

    // CRITICAL: Skip sync if promoting (state machine is managing the session)
    if (isPromoting) {
      console.log('[MessageSync] Skipping sync during promotion');
      return;
    }

    // Skip draft sessions
    if (session.state === SESSION_STATE.DRAFT) {
      return;
    }

    const currentMessages = session.messages || [];

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
      updateSession(sessionId, { messages: derivedMessages });
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 350);
    }
  }, [derivedMessages, updateSession, isPromoting]);

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

    // Status (✅ includes isPromoting for UI)
    sendLoading: !done || isPromoting, // ✅ Loading if sending OR promoting
    scrollRef,
    messageContainerRef,
    stopOutputMessage,

    // Session management
    currentSession,
    currentSessionId,
    sessions,
    createSession,
    switchSession,
    updateSession,
    getOrCreateDraftForCard,
    resetDraft,
    ...sessionActions,

    // ✅ Session state (for UI to show loading/disabled states)
    isDraft,
    isPromoting, // ✅ IMPORTANT: UI should disable input when true
    isActive,
    promotionError, // ✅ Show error message if promotion failed

    // Dialog ID
    dialogId,
    setDialogId,
  };
};
