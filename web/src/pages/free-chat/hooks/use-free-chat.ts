import { MessageType } from '@/constants/chat';
import {
  useHandleMessageInputChange,
  useSendMessageWithSse,
  useSelectDerivedMessages,
} from '@/hooks/logic-hooks';
import { Message } from '@/interfaces/database/chat';
import api from '@/utils/api';
import { buildMessageUuid } from '@/utils/chat';
import { trim } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { DynamicModelParams } from '../types';
import { useKBContext } from '../contexts/kb-context';
import { useFreeChatSession } from './use-free-chat-session';
import { useUpdateConversation } from '@/hooks/use-chat-request';
import { logError, logInfo } from '../utils/error-handler';
import { useTranslate } from '@/hooks/common-hooks';

interface UseFreeChatProps {
  userId: string;
  settings: any; // FreeChatSettings from API
  onSessionsChange?: (sessions: any[]) => void;
}

export const useFreeChat = (
  controller: AbortController,
  userId?: string,
  settings?: UseFreeChatProps['settings'],
  onSessionsChange?: (sessions: any[]) => void,
) => {
  const { t } = useTranslate('chat');

  const { enabledKBs } = useKBContext();
  const { handleInputChange, value, setValue } = useHandleMessageInputChange();
  const { updateConversation } = useUpdateConversation();

  const {
    currentSession,
    currentSessionId,
    createSession,
    updateSession,
    sessions,
    switchSession,
    deleteSession,
    clearAllSessions,
  } = useFreeChatSession({
    initialSessions: settings?.sessions,
    onSessionsChange,
  });

  const [dialogId, setDialogId] = useState<string>(settings?.dialog_id || '');

  // Sync dialogId from settings
  useEffect(() => {
    if (settings?.dialog_id) {
      setDialogId(settings.dialog_id);
    }
  }, [settings?.dialog_id]);

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
        // Ensure model_card_id exists before creating conversation
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

        const convData = await updateConversation({
          dialog_id: dialogId,
          name: message.content.slice(0, 50),
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
          // Update session with conversation_id
          if (currentSession) {
            updateSession(currentSession.id, { conversation_id: conversationId });
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

      // Ensure model_card_id exists before sending message
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
      t,
    ],
  );

  // BUG FIX #2: Handle session creation and message sending properly
  // Store pending message content when session is being created
  const pendingMessageRef = useRef<string | null>(null);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (trim(content) === '') return;

      // Create session if not exists and mark message as pending
      if (!currentSession) {
        // Extract meaningful title: trim, limit to 50 chars, remove newlines
        const title = content.trim().replace(/\n+/g, ' ').slice(0, 50);
        createSession(title);
        // Store pending message to be sent after session is created
        pendingMessageRef.current = content;
        return;
      }

      const id = uuid();
      const message: Message = {
        id,
        content: content.trim(),
        role: MessageType.User,
      };

      // Add user message
      addNewestQuestion(message);

      if (done) {
        setValue('');
        await sendMessage(message);
      }
    },
    [currentSession, createSession, addNewestQuestion, done, setValue, sendMessage],
  );

  // Send pending message when session becomes available
  useEffect(() => {
    if (currentSession && pendingMessageRef.current) {
      const content = pendingMessageRef.current;
      pendingMessageRef.current = null; // Clear pending

      const id = uuid();
      const message: Message = {
        id,
        content: content.trim(),
        role: MessageType.User,
      };

      addNewestQuestion(message);

      if (done) {
        setValue('');
        sendMessage(message);
      }
    }
  }, [currentSession, addNewestQuestion, done, setValue, sendMessage]);

  // Press Enter to send
  const handlePressEnter = useCallback(() => {
    handleSendMessage(value);
  }, [handleSendMessage, value]);

  // Regenerate answer
  const regenerateMessage = useCallback(
    async (message: Message) => {
      if (message.id) {
        const index = derivedMessages.findIndex((x) => x.id === message.id);
        if (index !== -1) {
          const newMessages = derivedMessages.slice(0, index + 1);
          setDerivedMessages(newMessages);
          await sendMessage(message);
        }
      }
    },
    [derivedMessages, setDerivedMessages, sendMessage],
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
    handleSendMessage,
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

    // Dialog ID
    dialogId,
    setDialogId,
  };
};
