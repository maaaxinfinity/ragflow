/**
 * FreeChat Core Hook - Refactored for Lazy Loading Architecture
 * 
 * ✅ Architecture Principles Implemented:
 * 1. Separation of Concerns: Messages stored in conversation table, metadata in sessions
 * 2. Lazy Loading: Messages loaded on-demand when switching sessions
 * 3. Real-time Write: User messages immediately written to conversation table
 * 
 * Key Changes:
 * - Sessions no longer contain 'messages' field
 * - Messages managed separately in 'currentMessages' state
 * - Lazy loading via useLazyLoadMessages hook
 * - Session updates only write metadata (30s debounce)
 */

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
import { useFreeChatSession } from './use-free-chat-session';
import { useLazyLoadMessages } from './use-lazy-load-messages';
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
  
  // FIX: Track if we're in the middle of sending a message
  // Use state instead of ref so lazy-load can react to changes
  const [isSending, setIsSending] = useState<boolean>(false);

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

  // ✅ NEW: Lazy load messages when switching sessions (Principle 2: Lazy Loading)
  // FIX: Disable lazy-load during message sending to prevent race conditions
  const {
    data: loadedMessagesData,
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useLazyLoadMessages(currentSession?.conversation_id, {
    enabled: !isSending,  // Disable fetch when sending
  });

  // ✅ NEW: Sync loaded messages to derivedMessages when data arrives or session changes
  useEffect(() => {
    if (currentSessionId) {
      if (loadedMessagesData?.messages) {
        // Lazy load succeeded - use loaded messages
        setDerivedMessages(loadedMessagesData.messages);
        logInfo(`[useFreeChat] Loaded ${loadedMessagesData.messages.length} messages for session ${currentSessionId}`);
      } else if (!currentSession?.conversation_id) {
        // New session without conversation_id - start with empty messages
        setDerivedMessages([]);
      }
      // else: loading in progress or error - keep current messages
    } else {
      setDerivedMessages([]);
    }
  }, [currentSessionId, loadedMessagesData, currentSession?.conversation_id, setDerivedMessages]);

  // BUGFIX: Handle conversation deletion error with strict error code checking
  // Only clear conversation_id for DATA_ERROR (102) or NOT_FOUND (404) codes
  // Other errors (network, auth, etc.) should NOT clear the session data
  useEffect(() => {
    if (messagesError && currentSession?.conversation_id) {
      const error: any = messagesError;
      
      // STRICT CHECK: Only handle "resource not found" errors
      // DATA_ERROR (102): Backend returned explicit "conversation not found"
      // NOT_FOUND (404): HTTP 404 status
      const isResourceNotFoundError = 
        (error.code === 102 || error.code === 404) && 
        error.conversationId === currentSession.conversation_id;
      
      if (isResourceNotFoundError) {
        logError(
          `Conversation ${currentSession.conversation_id} not found (code: ${error.code}), clearing from session`,
          'useFreeChat.messagesError',
          false
        );
        // Clear the invalid conversation_id from session
        updateSession(currentSession.id, {
          conversation_id: undefined,
        });
        // Clear messages
        setDerivedMessages([]);
      } else {
        // Other errors: just log, don't clear session data
        // This prevents data loss from transient network/auth issues
        logError(
          `Failed to load messages (code: ${error.code}), keeping session data intact`,
          'useFreeChat.messagesError',
          false
        );
      }
    }
  }, [messagesError, currentSession, updateSession, setDerivedMessages]);

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
      // FIX: Set sending flag to prevent lazy-load from clearing messages
      setIsSending(true);
      
      try {
        if (!dialogId) {
          logError(
            t('noDialogIdError'),
            'useFreeChat.sendMessage',
            true,
            t('noDialogIdError')
          );
          return;
        }

        // CRITICAL: Convert draft session to persistent when sending first message
        // This ensures temporary "新对话" becomes a real saved conversation
        if (currentSession?.isDraft) {
          console.log('[useFreeChat] Converting draft session to persistent:', currentSession.id);
          updateSession(currentSession.id, { isDraft: undefined });
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

          // ✅ UI Improvement: Auto-generate session title from first message (30 chars max)
          // Use session name if user renamed it (not the default "新对话")
          // Otherwise auto-generate from first message content
          let conversationName = currentSession.name;
          if (!conversationName || conversationName === '新对话') {
            // Auto-generate: take first 30 chars, replace newlines, add ellipsis if truncated
            const cleanContent = message.content.replace(/[\n\r]+/g, ' ').trim();
            conversationName = cleanContent.slice(0, 30) + (cleanContent.length > 30 ? '...' : '');
          }

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
            // Update session with conversation_id AND auto-generated name
            // This ensures the session is renamed when user sends first message
            if (currentSession) {
              updateSession(currentSession.id, { 
                conversation_id: conversationId,
                name: conversationName  // Auto-rename session to match conversation
              });
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
          // ✅ NEW: Update session metadata ONLY (Principle 3: Differentiated Write Strategy)
          // Messages already written to conversation table by backend
          // Here we only update UI metadata with 30s debounce (via onSessionsChange)
          if (currentSession) {
            updateSession(currentSession.id, {
              updated_at: Date.now(),
              message_count: (currentSession.message_count || 0) + 1,
            });
          }
        }
      } finally {
        // FIX: Always clear sending flag, even if there was an error
        setIsSending(false);
      }
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

  // ✅ REMOVED: derivedMessages sync to session
  // OLD ARCHITECTURE: Session stored full message arrays - required sync effect
  // NEW ARCHITECTURE: Messages stored in conversation table only
  //   - No need to sync derivedMessages to session
  //   - Session only stores metadata (name, model_card_id, params, etc.)
  //   - Updated_at and message_count synced on message send (see sendMessage below)

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
    isLoadingMessages,  // ✅ NEW: Loading state for lazy-loaded messages
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
