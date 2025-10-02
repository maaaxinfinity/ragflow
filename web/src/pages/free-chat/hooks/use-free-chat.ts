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
import { useDynamicParams } from './use-dynamic-params';
import { useKBToggle } from './use-kb-toggle';
import { useFreeChatSession } from './use-free-chat-session';
import { useUpdateConversation } from '@/hooks/use-chat-request';

// Free Chat uses a special dialog_id
// User needs to create a "Free Chat" dialog first
const FREE_CHAT_DIALOG_ID = 'free_chat_default';

export const useFreeChat = (controller: AbortController) => {
  const { params, paramsChanged, clearChangedFlag } = useDynamicParams();
  const { enabledKBs } = useKBToggle();
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
  } = useFreeChatSession();

  const [dialogId, setDialogId] = useState<string>('');

  // Load dialog ID from localStorage
  useEffect(() => {
    const savedDialogId = localStorage.getItem('free_chat_dialog_id');
    if (savedDialogId) {
      setDialogId(savedDialogId);
    }
  }, []);

  // Update localStorage when dialogId changes
  useEffect(() => {
    if (dialogId) {
      localStorage.setItem('free_chat_dialog_id', dialogId);
    }
  }, [dialogId]);

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
        console.error('No dialog ID set for Free Chat');
        return;
      }

      let conversationId = currentSession?.conversation_id;

      // Create conversation if not exists
      if (!conversationId) {
        const convData = await updateConversation({
          dialog_id: dialogId,
          name: message.content.slice(0, 50),
          is_new: true,
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
          console.error('Failed to create conversation');
          removeLatestMessage();
          return;
        }
      }

      // BUG FIX #7: Ensure kb_ids from enabledKBs has priority over params
      const baseParams = customParams || params;
      const requestBody = {
        conversation_id: conversationId,
        messages: [...derivedMessages, message],
        // Dynamic parameters
        ...baseParams,
        // Dynamic knowledge base (overrides any kb_ids in params)
        ...(enabledKBs.size > 0 && { kb_ids: Array.from(enabledKBs) }),
      };

      const res = await send(requestBody, controller);

      if (res && (res?.response.status !== 200 || res?.data?.code !== 0)) {
        setValue(message.content);
        removeLatestMessage();
      }
      // BUG FIX #1: Remove duplicate session update here
      // The session will be updated by the derivedMessages sync effect

      // Clear parameter change flag
      if (paramsChanged) {
        clearChangedFlag();
      }
    },
    [
      dialogId,
      currentSession,
      derivedMessages,
      params,
      enabledKBs,
      send,
      controller,
      setValue,
      removeLatestMessage,
      paramsChanged,
      clearChangedFlag,
      updateConversation,
      updateSession,
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
        createSession(content.slice(0, 30));
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

  // BUG FIX #1 & #9: Properly sync derivedMessages to session storage
  // Use ref to store session ID to avoid dependency on currentSession object
  const currentSessionIdRef = useRef(currentSessionId);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    const sessionId = currentSessionIdRef.current;
    if (sessionId && derivedMessages.length > 0 && !isSyncingRef.current) {
      // Find the current session from the messages to compare
      const session = sessions.find(s => s.id === sessionId);
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
        // Reset flag after a tick to allow next update
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 0);
      }
    }
  }, [derivedMessages, sessions, updateSession]); // Use sessions instead of currentSession

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

    // Parameter prompt
    paramsChanged,

    // Session management
    currentSession,
    currentSessionId,
    sessions,
    createSession,
    switchSession,
    deleteSession,

    // Dialog ID
    dialogId,
    setDialogId,
  };
};
