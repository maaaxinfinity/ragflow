/**
 * FreeChat Session Store (Zustand)
 * 
 * Migrated from Lobe Chat's state management pattern
 * Solves the state synchronization issues in the original useFreeChatSession hook
 * 
 * Features:
 * - Centralized session state management
 * - Redux DevTools support for debugging
 * - Persistence support (localStorage backup)
 * - Type-safe operations
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { Message } from '@/interfaces/database/chat';

export interface IFreeChatSession {
  id: string;
  conversation_id?: string;
  model_card_id?: number;
  name: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
  state?: 'draft' | 'active';  // draft = temporary local only, active = persisted to backend
  is_favorited?: boolean;  // favorite status (only for active sessions)
  params?: {
    temperature?: number;
    top_p?: number;
    role_prompt?: string;
    [key: string]: any;
  };
}

interface SessionState {
  // State
  sessions: IFreeChatSession[];
  currentSessionId: string;
  isLoading: boolean;
  
  // Computed
  currentSession: IFreeChatSession | undefined;
}

interface SessionActions {
  // Basic CRUD
  setSessions: (sessions: IFreeChatSession[]) => void;
  setCurrentSessionId: (id: string) => void;
  createSession: (name?: string, model_card_id?: number, isDraft?: boolean, conversationId?: string) => IFreeChatSession;
  updateSession: (id: string, updates: Partial<IFreeChatSession>) => void;
  deleteSession: (id: string) => void;
  switchSession: (id: string) => void;
  clearAllSessions: () => void;
  toggleFavorite: (id: string) => void;
  deleteUnfavorited: () => void;
  
  // Advanced operations
  duplicateSession: (id: string, newName?: string) => IFreeChatSession | null;
  updateSessionMessages: (id: string, messages: Message[]) => void;
  updateSessionParams: (id: string, params: Partial<IFreeChatSession['params']>) => void;
  
  // Utility
  getSessionById: (id: string) => IFreeChatSession | undefined;
  setLoading: (isLoading: boolean) => void;
}

type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  persist(
    devtools(
      (set, get) => ({
        // Initial State
        sessions: [],
        currentSessionId: '',
        isLoading: false,
        
        // Computed
        get currentSession() {
          const { sessions, currentSessionId } = get();
          return sessions.find((s) => s.id === currentSessionId);
        },
      
      // Actions
      setSessions: (sessions) => {
        // Ensure all sessions have proper state field (backward compatibility)
        const normalizedSessions = sessions.map(s => ({
          ...s,
          // If no state, infer from conversation_id
          state: s.state || (s.conversation_id ? 'active' : 'draft')
        }));
        set({ sessions: normalizedSessions }, false, 'setSessions');
      },
      
      setCurrentSessionId: (id) => {
        set({ currentSessionId: id }, false, 'setCurrentSessionId');
      },
      
      createSession: (name, model_card_id, isDraft = false, conversationId) => {
        // If conversationId provided, use it as id (for Draft→Active promotion)
        // Otherwise generate new UUID
        const sessionId = conversationId || uuid();
        
        const newSession: IFreeChatSession = {
          id: sessionId,
          conversation_id: isDraft ? undefined : conversationId,  // Draft has no conversation_id
          name: name || '新对话',
          model_card_id,
          messages: [],
          created_at: Date.now(),
          updated_at: Date.now(),
          state: isDraft ? 'draft' : 'active',
          params: {},
        };
        
        console.log('[Zustand] createSession:', {
          id: sessionId,
          isDraft,
          conversationId,
          state: newSession.state
        });
        
        set(
          (state) => ({
            sessions: [newSession, ...state.sessions],
            currentSessionId: newSession.id,
          }),
          false,
          'createSession',
        );
        
        return newSession;
      },
      
      updateSession: (id, updates) => {
        set(
          (state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id
                ? { ...s, ...updates, updated_at: Date.now() }
                : s
            ),
          }),
          false,
          'updateSession',
        );
      },
      
      deleteSession: (id) => {
        set(
          (state) => {
            const newSessions = state.sessions.filter((s) => s.id !== id);
            const newCurrentId =
              state.currentSessionId === id && newSessions.length > 0
                ? newSessions[0].id
                : state.currentSessionId === id
                ? ''
                : state.currentSessionId;
            
            return {
              sessions: newSessions,
              currentSessionId: newCurrentId,
            };
          },
          false,
          'deleteSession',
        );
      },
      
      switchSession: (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (session) {
          set({ currentSessionId: id }, false, 'switchSession');
        }
      },
      
      clearAllSessions: () => {
        set(
          {
            sessions: [],
            currentSessionId: '',
          },
          false,
          'clearAllSessions',
        );
      },
      
      duplicateSession: (id, newName) => {
        const originalSession = get().sessions.find((s) => s.id === id);
        if (!originalSession) return null;
        
        const duplicatedSession: IFreeChatSession = {
          ...originalSession,
          id: uuid(),
          name: newName || `${originalSession.name} (副本)`,
          conversation_id: undefined, // Reset conversation_id
          messages: [], // Start with empty messages
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        
        set(
          (state) => ({
            sessions: [duplicatedSession, ...state.sessions],
            currentSessionId: duplicatedSession.id,
          }),
          false,
          'duplicateSession',
        );
        
        return duplicatedSession;
      },
      
      updateSessionMessages: (id, messages) => {
        set(
          (state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id
                ? { ...s, messages, updated_at: Date.now() }
                : s
            ),
          }),
          false,
          'updateSessionMessages',
        );
      },
      
      updateSessionParams: (id, params) => {
        set(
          (state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id
                ? {
                    ...s,
                    params: { ...s.params, ...params },
                    updated_at: Date.now(),
                  }
                : s
            ),
          }),
          false,
          'updateSessionParams',
        );
      },
      
      getSessionById: (id) => {
        return get().sessions.find((s) => s.id === id);
      },
      
      setLoading: (isLoading) => {
        set({ isLoading }, false, 'setLoading');
      },
      
      toggleFavorite: (id) => {
        set(
          (state) => ({
            sessions: state.sessions.map((s) =>
              s.id === id
                ? { ...s, is_favorited: !s.is_favorited, updated_at: Date.now() }
                : s
            ),
          }),
          false,
          'toggleFavorite',
        );
      },
      
      deleteUnfavorited: () => {
        set(
          (state) => {
            const unfavorited = state.sessions.filter(
              (s) => s.state === 'active' && !s.is_favorited
            );
            const remaining = state.sessions.filter(
              (s) => s.state === 'draft' || s.is_favorited
            );
            
            console.log('[deleteUnfavorited] Deleting', unfavorited.length, 'unfavorited sessions');
            
            // Switch to draft if current session is deleted
            let newCurrentId = state.currentSessionId;
            if (unfavorited.some(s => s.id === state.currentSessionId)) {
              const draft = remaining.find(s => s.state === 'draft');
              newCurrentId = draft?.id || remaining[0]?.id || '';
            }
            
            return {
              sessions: remaining,
              currentSessionId: newCurrentId,
            };
          },
          false,
          'deleteUnfavorited',
        );
      },
    }),
    {
      name: 'FreeChat_Session',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
  {
    name: 'freechat-session-storage',
    // Only persist sessions and currentSessionId
    partialize: (state) => ({
      sessions: state.sessions,
      currentSessionId: state.currentSessionId,
    }),
    // Skip persistence in test environment
    skipHydration: process.env.NODE_ENV === 'test',
  },
),
);

// Selectors (following Lobe Chat pattern)
export const sessionSelectors = {
  currentSession: (state: SessionStore) => state.currentSession,
  currentSessionId: (state: SessionStore) => state.currentSessionId,
  sessions: (state: SessionStore) => state.sessions,
  isLoading: (state: SessionStore) => state.isLoading,
  getSessionById: (id: string) => (state: SessionStore) => state.getSessionById(id),
  sessionCount: (state: SessionStore) => state.sessions.length,
  hasSession: (state: SessionStore) => state.sessions.length > 0,
};
