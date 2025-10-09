import { MessageType } from '@/constants/chat';
import {
  useHandleMessageInputChange,
  useSendMessageWithSse,
  useSelectDerivedMessages,
} from '@/hooks/logic-hooks';
import { Message } from '@/interfaces/database/chat';
import api from '@/utils/api';
import { trim } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { DynamicModelParams } from '../types';
import { useKBContext } from '../contexts/kb-context';
import { useFreeChatSessionQuery } from './use-free-chat-session-query';
import { useUpdateConversation } from '@/hooks/use-chat-request';
import { logError, logInfo } from '../utils/error-handler';
import { useTranslate } from '@/hooks/common-hooks';

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

  // Use TanStack Query for session management (replaces localStorage)
  const {
    currentSession,
    currentSessionId,
    createSession,
    updateSession,
    sessions,
    switchSession,
    deleteSession,
    clearAllSessions,
    refetchSessions,  // Used for manual refresh after operations
  } = useFreeChatSessionQuery({
    userId,
    dialogId,
    enabled: !!userId && !!dialogId,
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

  // BUG FIX #10: Only sync when currentSessionId changes, not when currentSession object changes
  // This prevents overwriting derivedMessages when session is updated
  useEffect(() => {
    if (currentSession) {
      setDerivedMessages(currentSession.messages || []);
    } else {
      setDerivedMessages([]);
    }
  }, [currentSessionId, setDerivedMessages]); // Remove currentSession from deps

  // Stop output
  const stopOutputMessage = useCallback(() => {
    controller.abort();
  }, [controller]);

  // FIX: Add validation to handlePressEnter before sending
  // Press Enter to send
  const handlePressEnter = useCallback(() => {
    if (trim(value) === '') return;
    if (!done) return;  // FIX: Use 'done' instead of 'sendLoading' to avoid reference error

    // Validate model_card_id before sending
    if (!currentSession?.model_card_id) {
      logError(
        'Please select an assistant first',
        'useFreeChat.handlePressEnter',
        true,
        t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手')
      );
      return;
    }

    const message: Message = {
      id: uuid(),  // FIX: Use uuid() directly instead of buildMessageUuid() without args
      role: MessageType.User,
      content: value,
    };

    addNewestQuestion(message);
    setValue('');
    sendMessage(message);
  }, [value, done, currentSession, addNewestQuestion, setValue, sendMessage, t]);

  // Send message (core logic)
  const sendMessage = useCallback(
    async (message: Message, customParams?: DynamicModelParams) => {
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

      // Create conversation if not exists
      if (!conversationId) {
        // FIX: Ensure model_card_id exists before creating conversation
        // Without model_card_id, backend cannot apply model card parameters
        if (!currentSession?.model_card_id) {
          logError(
            'Please select an assistant first',
            'useFreeChat.sendMessage',
            true,
            t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手')
          );
          removeLatestMessage();
          return;
        }

        // Use session name if user renamed it (not the default "新对话"), otherwise use message content
        const conversationName = currentSession.name && currentSession.name !== '新对话'
          ? currentSession.name
          : message.content.slice(0, 50);

        const convData = await updateConversation({
          dialog_id: dialogId,
          name: conversationName,
          is_new: true,
          model_card_id: currentSession.model_card_id,  // Add model_card_id
          message: [
            {
              role: MessageType.Assistant,
              content: '',
            },
          ],
        });

        if (convData.code === 0) {
          conversationId = convData.data.id;
          // FIX: Promote draft to active and update with conversation_id
          if (currentSession) {
            updateSession(currentSession.id, { 
              conversation_id: conversationId,
              name: conversationName,  // Auto-rename based on first message
              state: 'active'  // Promote draft to active
            });
            console.log('[SendMessage] Draft promoted to active:', currentSession.id, '→', conversationId);
          }
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

      // FIX: Ensure model_card_id exists before sending message
      // This check prevents sending messages without an associated assistant
      if (!currentSession?.model_card_id) {
        logError(
          'Please select an assistant first',
          'useFreeChat.sendMessage',
          true,
          t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手')
        );
        removeLatestMessage();
        return;
      }

      // BUG FIX #7 & #12: Ensure kb_ids from enabledKBs has priority over params
      // Use session.params for conversation-level parameter overrides
      // Backend will merge: conversation params > model card params > bot defaults
      const baseParams = customParams || currentSession.params || {};
      const kbIdsArray = Array.from(enabledKBs);

      const requestBody = {
        conversation_id: conversationId,
        messages: [...derivedMessages, message],
        // Dynamic parameters from session (temperature, top_p)
        ...(baseParams.temperature !== undefined && { temperature: baseParams.temperature }),
        ...(baseParams.top_p !== undefined && { top_p: baseParams.top_p }),
        // Model card ID (REQUIRED - for parameter merging on backend)
        // Type assertion: we've already validated model_card_id exists above
        model_card_id: currentSession.model_card_id!,
        // Dynamic knowledge base (always include, overrides any kb_ids in params)
        kb_ids: kbIdsArray,
        // Dynamic role prompt from session (system prompt override)
        ...(baseParams.role_prompt !== undefined && { role_prompt: baseParams.role_prompt }),
      };

      const res = await send(requestBody, controller);

      if (res && (res?.response.status !== 200 || res?.data?.code !== 0)) {
        setValue(message.content);
        removeLatestMessage();
      } else {
        // Success: trigger session list refresh to sync latest updates
        setTimeout(() => {
          console.log('[SendMessage] Triggering session refresh after successful send');
          refetchSessions();
        }, 1000);
      }
      // BUG FIX #1: Remove duplicate session update here
      // The session will be updated by the derivedMessages sync effect
    },
    [
      dialogId,
      currentSession,
      derivedMessages,
      enabledKBs,
      send,
      controller,
      setValue,
      removeLatestMessage,
      updateConversation,
      updateSession,
      refetchSessions,
      t,
    ],
  );

  // REMOVED: handleSendMessage and pendingMessage mechanism
  // Replaced with direct validation in handlePressEnter
  // This simplifies the code and prevents message loss issues

  // FIX: Regenerate answer with proper error handling
  // Prevents message loss when regeneration fails
  const regenerateMessage = useCallback(
    async (message: Message) => {
      // Validate model_card_id before attempting regeneration
      if (!currentSession?.model_card_id) {
        logError(
          'Cannot regenerate: no assistant selected',
          'useFreeChat.regenerateMessage',
          true,
          t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手')
        );
        return;  // Don't delete messages, just return
      }

      if (message.id) {
        const index = derivedMessages.findIndex((x) => x.id === message.id);
        if (index !== -1) {
          // Save original messages for rollback on failure
          const originalMessages = [...derivedMessages];
          const newMessages = derivedMessages.slice(0, index + 1);
          setDerivedMessages(newMessages);
          
          try {
            await sendMessage(message);
          } catch (error) {
            // Rollback to original messages on failure
            setDerivedMessages(originalMessages);
            logError(
              'Failed to regenerate message',
              'useFreeChat.regenerateMessage',
              true,
              error instanceof Error ? error.message : t('unknownError', '未知错误')
            );
          }
        }
      }
    },
    [currentSession, derivedMessages, setDerivedMessages, sendMessage, t],
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
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    const sessionId = currentSessionIdRef.current;
    if (sessionId && derivedMessages.length > 0 && !isSyncingRef.current) {
      // Find the current session from the ref to avoid circular dependency
      const session = sessionsRef.current.find(s => s.id === sessionId);
      if (!session) return;

      const currentMessages = session.messages || [];
      const messagesChanged =
        derivedMessages.length !== currentMessages.length ||
        derivedMessages.some((msg, idx) => {
          const current = currentMessages[idx];
          return !current || msg.id !== current.id || msg.content !== current.content;
        });

      if (messagesChanged) {
        isSyncingRef.current = true;
        updateSession(sessionId, {
          messages: derivedMessages,
        });
        // Use Promise.resolve() instead of setTimeout for more reliable microtask scheduling
        Promise.resolve().then(() => {
          isSyncingRef.current = false;
        });
      }
    }
  }, [derivedMessages, updateSession]); // BUG FIX: Remove sessions dependency to avoid circular updates

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
    refetchSessions,  // Manual refresh sessions from backend

    // Dialog ID
    dialogId,
    setDialogId,
  };
};
