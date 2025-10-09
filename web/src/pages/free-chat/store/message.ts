/**
 * FreeChat Message Store (Zustand)
 * 
 * Separates message management from session management
 * Prevents circular dependencies and state synchronization issues
 * 
 * Features:
 * - Organizes messages by sessionId
 * - Independent from session state
 * - Persistence support (localStorage backup)
 * - Type-safe message operations
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { Message } from '@/interfaces/database/chat';

interface MessageState {
  // State: sessionId -> Message[]
  messages: Record<string, Message[]>;
}

interface MessageActions {
  // Basic CRUD
  setMessages: (sessionId: string, messages: Message[]) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (sessionId: string, messageId: string) => void;
  clearMessages: (sessionId: string) => void;
  clearAllMessages: () => void;
  
  // Advanced operations
  addUserMessage: (sessionId: string, content: string) => Message;
  addAssistantMessage: (sessionId: string, content: string, reference?: any[]) => Message;
  updateLastAssistantMessage: (sessionId: string, content: string, reference?: any[]) => void;
  removeLatestMessage: (sessionId: string) => void;
  
  // Utility
  getMessages: (sessionId: string) => Message[];
  getMessageById: (sessionId: string, messageId: string) => Message | undefined;
  hasMessages: (sessionId: string) => boolean;
}

type MessageStore = MessageState & MessageActions;

export const useMessageStore = create<MessageStore>()(
  persist(
    devtools(
      (set, get) => ({
      // Initial State
      messages: {},
      
      // Actions
      setMessages: (sessionId, messages) => {
        set(
          (state) => ({
            messages: { ...state.messages, [sessionId]: messages },
          }),
          false,
          'setMessages',
        );
      },
      
      addMessage: (sessionId, message) => {
        set(
          (state) => ({
            messages: {
              ...state.messages,
              [sessionId]: [...(state.messages[sessionId] || []), message],
            },
          }),
          false,
          'addMessage',
        );
      },
      
      updateMessage: (sessionId, messageId, updates) => {
        set(
          (state) => ({
            messages: {
              ...state.messages,
              [sessionId]: (state.messages[sessionId] || []).map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
            },
          }),
          false,
          'updateMessage',
        );
      },
      
      removeMessage: (sessionId, messageId) => {
        set(
          (state) => ({
            messages: {
              ...state.messages,
              [sessionId]: (state.messages[sessionId] || []).filter(
                (m) => m.id !== messageId
              ),
            },
          }),
          false,
          'removeMessage',
        );
      },
      
      clearMessages: (sessionId) => {
        set(
          (state) => ({
            messages: { ...state.messages, [sessionId]: [] },
          }),
          false,
          'clearMessages',
        );
      },
      
      clearAllMessages: () => {
        set({ messages: {} }, false, 'clearAllMessages');
      },
      
      addUserMessage: (sessionId, content) => {
        const message: Message = {
          id: uuid(),
          role: 'user',
          content,
        };
        
        get().addMessage(sessionId, message);
        return message;
      },
      
      addAssistantMessage: (sessionId, content, reference) => {
        const message: Message = {
          id: uuid(),
          role: 'assistant',
          content,
          reference,
        };
        
        get().addMessage(sessionId, message);
        return message;
      },
      
      updateLastAssistantMessage: (sessionId, content, reference) => {
        const messages = get().messages[sessionId] || [];
        const lastAssistantMessage = [...messages]
          .reverse()
          .find((m) => m.role === 'assistant');
        
        if (lastAssistantMessage) {
          get().updateMessage(sessionId, lastAssistantMessage.id, {
            content,
            reference,
          });
        }
      },
      
      removeLatestMessage: (sessionId) => {
        set(
          (state) => {
            const messages = state.messages[sessionId] || [];
            if (messages.length === 0) return state;
            
            return {
              messages: {
                ...state.messages,
                [sessionId]: messages.slice(0, -1),
              },
            };
          },
          false,
          'removeLatestMessage',
        );
      },
      
      getMessages: (sessionId) => {
        return get().messages[sessionId] || [];
      },
      
      getMessageById: (sessionId, messageId) => {
        return (get().messages[sessionId] || []).find((m) => m.id === messageId);
      },
      
      hasMessages: (sessionId) => {
        return (get().messages[sessionId] || []).length > 0;
      },
      }),
      {
        name: 'FreeChat_Message',
        enabled: process.env.NODE_ENV === 'development',
      },
    ),
    {
      name: 'freechat-message-storage',
      // Persist all messages
      partialize: (state) => ({
        messages: state.messages,
      }),
      // Skip persistence in test environment
      skipHydration: process.env.NODE_ENV === 'test',
    },
  ),
);

// Selectors
export const messageSelectors = {
  getMessages: (sessionId: string) => (state: MessageStore) => 
    state.getMessages(sessionId),
  hasMessages: (sessionId: string) => (state: MessageStore) => 
    state.hasMessages(sessionId),
  messageCount: (sessionId: string) => (state: MessageStore) => 
    (state.messages[sessionId] || []).length,
};
