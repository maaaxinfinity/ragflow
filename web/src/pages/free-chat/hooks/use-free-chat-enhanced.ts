/**
 * Enhanced useFreeChat Hook
 * 
 * Integrates Message Store for better message management
 * Simplifies the complex message synchronization logic
 */

import { MessageType } from '@/constants/chat';
import {
  useHandleMessageInputChange,
  useSendMessageWithSse,
} from '@/hooks/logic-hooks';
import { Message } from '@/interfaces/database/chat';
import api from '@/utils/api';
import { trim } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { DynamicModelParams } from '../types';
import { useKBContext } from '../contexts/kb-context';
import { useFreeChatSession } from './use-free-chat-session';
import { useUpdateConversation } from '@/hooks/use-chat-request';
import { logError } from '../utils/error-handler';
import { useTranslate } from '@/hooks/common-hooks';
import { useMessageStore } from '../store/message';
import { useSessionStore } from '../store/session';

interface UseFreeChatEnhancedProps {
  userId?: string;
  settings?: any; // FreeChatSettings from API
  onSessionsChange?: (sessions: any[]) => void;
}

export const useFreeChatEnhanced = (
  controller: AbortController,
  props: UseFreeChatEnhancedProps,
) => {
  const { userId, settings, onSessionsChange } = props;
  const { t } = useTranslate('chat');

  const { enabledKBs } = useKBContext();
  const { handleInputChange, value, setValue } = useHandleMessageInputChange();
  const { updateConversation } = useUpdateConversation();

  // Initialize dialogId from settings
  const [dialogId, setDialogId] = useState<string>(settings?.dialog_id || '');

  // Sync dialogId from settings
  useEffect(() => {
    if (settings?.dialog_id && settings.dialog_id !== dialogId) {
      console.log('[useFreeChat] Syncing dialogId from settings:', settings.dialog_id);
      setDialogId(settings.dialog_id);
    }
  }, [settings?.dialog_id, dialogId]);

  // Use enhanced session management with Zustand
  const {
    sessions,
    currentSession,
    currentSessionId,
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    clearAllSessions,
  } = useFreeChatSession({
    initialSessions: settings?.sessions,
    onSessionsChange,
  });

  // Get messages from Message Store
  const messages = useMessageStore((state) => state.getMessages(currentSessionId));
  const addMessage = useMessageStore((state) => state.addMessage);
  const addUserMessage = useMessageStore((state) => state.addUserMessage);
  const addAssistantMessage = useMessageStore((state) => state.addAssistantMessage);
  const updateLastAssistantMessage = useMessageStore((state) => state.updateLastAssistantMessage);
  const removeLatestMessage = useMessageStore((state) => state.removeLatestMessage);
  const clearMessages = useMessageStore((state) => state.clearMessages);

  // SSE sending logic
  const { send, answer, done } = useSendMessageWithSse(api.completeConversation);

  // Scroll refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Sync messages between Message Store and Session Store
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      // Update session with current messages
      updateSession(currentSessionId, { messages });
    }
  }, [messages, currentSessionId, updateSession]);

  // Load messages when switching sessions
  useEffect(() => {
    if (currentSessionId && currentSession) {
      const sessionMessages = currentSession.messages || [];
      
      // Only load if different from current messages
      if (JSON.stringify(sessionMessages) !== JSON.stringify(messages)) {
        console.log('[MessageSync] Loading messages for session:', currentSessionId, sessionMessages.length);
        useMessageStore.getState().setMessages(currentSessionId, sessionMessages);
      }
    } else if (!currentSessionId) {
      // No session selected, clear messages display
      useMessageStore.getState().setMessages('', []);
    }
  }, [currentSessionId, currentSession]); // Only depend on session change

  // Stop output
  const stopOutputMessage = useCallback(() => {
    controller.abort();
  }, [controller]);

  // Press Enter to send
  const handlePressEnter = useCallback(() => {
    if (trim(value) === '') return;
    if (!done) return;

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

    // Add user message to store
    const userMessage = addUserMessage(currentSessionId, value);
    setValue('');
    
    // Send message
    sendMessage(userMessage);
  }, [value, done, currentSession, currentSessionId, addUserMessage, setValue, t]);

  // Send message (core logic)
  const sendMessage = useCallback(
    async (message: Message, customParams?: DynamicModelParams) => {
      if (!dialogId) {
        logError(
          'Dialog ID is missing',
          'useFreeChat.sendMessage',
          true,
          '对话配置加载中，请稍候再试...'
        );
        removeLatestMessage(currentSessionId);
        return;
      }

      let conversationId = currentSession?.conversation_id;

      // Create conversation if not exists
      if (!conversationId) {
        if (!currentSession?.model_card_id) {
          logError(
            'Please select an assistant first',
            'useFreeChat.sendMessage',
            true,
            t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手')
          );
          removeLatestMessage(currentSessionId);
          return;
        }

        const conversationName =
          currentSession.name && currentSession.name !== '新对话'
            ? currentSession.name
            : message.content.slice(0, 50);

        const convData = await updateConversation({
          dialog_id: dialogId,
          name: conversationName,
          is_new: true,
          model_card_id: currentSession.model_card_id,
          message: [
            {
              role: MessageType.Assistant,
              content: '',
            },
          ],
        });

        if (convData.code === 0) {
          conversationId = convData.data.id;
          updateSession(currentSessionId, { conversation_id: conversationId });
        } else {
          logError(
            t('failedToCreateConversation'),
            'useFreeChat.sendMessage',
            true,
            t('failedToCreateConversation')
          );
          removeLatestMessage(currentSessionId);
          return;
        }
      }

      if (!currentSession?.model_card_id) {
        logError(
          'Please select an assistant first',
          'useFreeChat.sendMessage',
          true,
          t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手')
        );
        removeLatestMessage(currentSessionId);
        return;
      }

      const baseParams = customParams || currentSession.params || {};
      const kbIdsArray = Array.from(enabledKBs);

      const requestBody = {
        conversation_id: conversationId,
        messages: [...messages, message],
        ...(baseParams.temperature !== undefined && {
          temperature: baseParams.temperature,
        }),
        ...(baseParams.top_p !== undefined && { top_p: baseParams.top_p }),
        model_card_id: currentSession.model_card_id!,
        kb_ids: kbIdsArray,
        ...(baseParams.role_prompt !== undefined && {
          role_prompt: baseParams.role_prompt,
        }),
      };

      const res = await send(requestBody, controller);

      if (res && (res?.response.status !== 200 || res?.data?.code !== 0)) {
        setValue(message.content);
        removeLatestMessage(currentSessionId);
      }
    },
    [
      dialogId,
      currentSession,
      currentSessionId,
      messages,
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

  // Regenerate message
  const regenerateMessage = useCallback(
    async (message: Message) => {
      if (!currentSession?.model_card_id) {
        logError(
          'Cannot regenerate: no assistant selected',
          'useFreeChat.regenerateMessage',
          true,
          t('pleaseSelectAssistant', '请先在左侧"助手"标签中选择一个助手')
        );
        return;
      }

      if (message.id) {
        const index = messages.findIndex((x) => x.id === message.id);
        if (index !== -1) {
          const newMessages = messages.slice(0, index + 1);
          useMessageStore.getState().setMessages(currentSessionId, newMessages);
          
          try {
            await sendMessage(message);
          } catch (error) {
            // Rollback on failure
            useMessageStore.getState().setMessages(currentSessionId, messages);
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
    [currentSession, currentSessionId, messages, sendMessage, t],
  );

  // Listen to SSE answer updates
  useEffect(() => {
    if (answer.answer && currentSessionId) {
      updateLastAssistantMessage(currentSessionId, answer.answer, answer.reference);
    }
  }, [answer, currentSessionId, updateLastAssistantMessage]);

  // Remove message by ID
  const removeMessageById = useCallback(
    (messageId: string) => {
      useMessageStore.getState().removeMessage(currentSessionId, messageId);
    },
    [currentSessionId],
  );

  // Remove all messages
  const removeAllMessages = useCallback(() => {
    clearMessages(currentSessionId);
  }, [currentSessionId, clearMessages]);

  return {
    // Message related
    handlePressEnter,
    handleInputChange,
    value,
    setValue,
    derivedMessages: messages, // Use messages from store
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
