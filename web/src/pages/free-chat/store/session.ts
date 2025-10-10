/**
 * FreeChat Session Store (Zustand + Immer)
 *
 * ✅ Refactored (2025-01-11):
 * - Added Immer middleware for cleaner nested updates
 * - Single source of truth for session data
 * - XState machine only orchestrates transitions
 *
 * Features:
 * - Centralized session state management
 * - Redux DevTools support for debugging
 * - Persistence support (localStorage backup)
 * - Immer for mutable-style updates
 * - Type-safe operations
 */

import { Authorization } from '@/constants/authorization';
import type { Message } from '@/interfaces/database/chat';
import { getAuthorization } from '@/utils/authorization-util';
import { v4 as uuid } from 'uuid';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface IFreeChatSession {
  id: string;
  conversation_id?: string;
  model_card_id?: number;
  name: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
  state?: 'draft' | 'promoting' | 'active' | 'error'; // ✅ Added 'promoting' and 'error' states
  is_favorited?: boolean; // favorite status (only for active sessions)
  promotionError?: Error; // ✅ Store promotion errors
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

  // Computed (DEPRECATED: Use useMemo in hooks instead)
  // currentSession getter removed to avoid stale closure issues
  // Use: const currentSession = useMemo(() => sessions.find(s => s.id === currentSessionId), [sessions, currentSessionId])
}

interface SessionActions {
  // Basic CRUD
  setSessions: (sessions: IFreeChatSession[]) => void;
  setCurrentSessionId: (id: string) => void;
  createSession: (
    name?: string,
    model_card_id?: number,
    isDraft?: boolean,
    conversationId?: string,
  ) => IFreeChatSession;
  updateSession: (id: string, updates: Partial<IFreeChatSession>) => void;
  deleteSession: (id: string) => void;
  switchSession: (id: string) => void;
  clearAllSessions: () => void;
  toggleFavorite: (id: string) => void;
  deleteUnfavorited: () => void;

  // Draft management (CRITICAL: Each model card has ONE and ONLY ONE permanent draft)
  getOrCreateDraftForCard: (model_card_id: number) => IFreeChatSession;
  resetDraft: (draftId: string) => void;

  // ✅ Draft promotion (replaces XState machine)
  promoteToActive: (
    sessionId: string,
    message: Message,
    dialogId: string,
  ) => Promise<string>; // Returns conversation_id
  retryPromotion: (sessionId: string) => Promise<string>;

  // Advanced operations
  duplicateSession: (id: string, newName?: string) => IFreeChatSession | null;
  updateSessionMessages: (id: string, messages: Message[]) => void;
  updateSessionParams: (
    id: string,
    params: Partial<IFreeChatSession['params']>,
  ) => void;

  // Utility
  getSessionById: (id: string) => IFreeChatSession | undefined;
  setLoading: (isLoading: boolean) => void;
}

type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial State
        sessions: [],
        currentSessionId: '',
        isLoading: false,

        // Actions
        setSessions: (sessions) => {
          // Ensure all sessions have proper state field (backward compatibility)
          const normalizedSessions = sessions.map((s) => ({
            ...s,
            // If no state, infer from conversation_id
            state: s.state || (s.conversation_id ? 'active' : 'draft'),
          }));
          set({ sessions: normalizedSessions }, false, 'setSessions');
        },

        setCurrentSessionId: (id) => {
          set({ currentSessionId: id }, false, 'setCurrentSessionId');
        },

        createSession: (
          name,
          model_card_id,
          isDraft = false,
          conversationId,
        ) => {
          // If conversationId provided, use it as id (for Draft→Active promotion)
          // Otherwise generate new UUID
          const sessionId = conversationId || uuid();

          const newSession: IFreeChatSession = {
            id: sessionId,
            conversation_id: isDraft ? undefined : conversationId, // Draft has no conversation_id
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
            state: newSession.state,
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

        // ✅ BEST PRACTICE: Immer simplifies nested updates
        updateSession: (id, updates) =>
          set(
            (state) => {
              const session = state.sessions.find((s) => s.id === id);
              if (session) {
                Object.assign(session, updates);
                session.updated_at = Date.now();
              }
            },
            false,
            'updateSession',
          ),

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

        // CRITICAL: Get or create the ONE and ONLY draft for a model card
        getOrCreateDraftForCard: (model_card_id) => {
          const { sessions } = get();

          // Find existing draft for this model card
          const existingDraft = sessions.find(
            (s) => s.state === 'draft' && s.model_card_id === model_card_id,
          );

          if (existingDraft) {
            console.log(
              '[Zustand] Found existing draft for card:',
              model_card_id,
            );
            return existingDraft;
          }

          // No existing draft - create new one
          const draftId = `draft_${model_card_id}_${uuid()}`;
          const newDraft: IFreeChatSession = {
            id: draftId,
            conversation_id: undefined,
            model_card_id,
            name: '新对话',
            messages: [],
            created_at: Date.now(),
            updated_at: Date.now(),
            state: 'draft',
            params: {},
          };

          console.log('[Zustand] Creating new draft for card:', model_card_id);

          set(
            (state) => ({
              sessions: [newDraft, ...state.sessions],
            }),
            false,
            'getOrCreateDraftForCard',
          );

          return newDraft;
        },

        // Reset draft to initial state (used after Draft→Active promotion)
        // ✅ BEST PRACTICE: Reset properties directly
        resetDraft: (draftId) =>
          set(
            (state) => {
              const draft = state.sessions.find((s) => s.id === draftId);
              if (draft) {
                draft.name = '新对话';
                draft.messages = [];
                draft.params = {};
                draft.updated_at = Date.now();
              }
            },
            false,
            'resetDraft',
          ),

        // ✅ NEW: Draft promotion (replaces XState machine)
        promoteToActive: async (sessionId, message, dialogId) => {
          const session = get().sessions.find((s) => s.id === sessionId);
          if (!session || !session.model_card_id) {
            throw new Error('Session not found or missing model_card_id');
          }

          console.log('[Zustand] promoteToActive START:', {
            sessionId,
            dialogId,
            modelCardId: session.model_card_id,
          });

          // Set promoting state
          set(
            (state) => {
              const s = state.sessions.find((s) => s.id === sessionId);
              if (s) {
                s.state = 'promoting';
                s.promotionError = undefined;
              }
            },
            false,
            'promoteToActive:start',
          );

          try {
            // Generate conversation_id for new conversation
            const conversationId = uuid();

            // Call backend API with authentication
            const response = await fetch('/v1/conversation/set', {
              method: 'POST',
              headers: {
                [Authorization]: getAuthorization(),
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                conversation_id: conversationId, // ✅ FIX: Backend requires this even for is_new=true
                dialog_id: dialogId,
                name: message.content.slice(0, 50),
                is_new: true,
                model_card_id: session.model_card_id,
                message: [{ role: 'assistant', content: '' }],
              }),
            });

            const result = await response.json();
            console.log('[Zustand] promoteToActive API response:', {
              code: result.code,
              message: result.message,
              data: result.data,
            });

            if (result.code !== 0) {
              const errorMsg = `API Error ${result.code}: ${result.message || '创建对话失败'}`;
              console.error('[Zustand] promoteToActive API error:', errorMsg);
              throw new Error(errorMsg);
            }

            const finalConversationId = result.data.id || conversationId;
            console.log(
              '[Zustand] promoteToActive SUCCESS:',
              finalConversationId,
            );

            // Update to active state
            set(
              (state) => {
                const s = state.sessions.find((s) => s.id === sessionId);
                if (s) {
                  s.state = 'active';
                  s.conversation_id = finalConversationId;
                  s.name = message.content.slice(0, 50);
                  s.updated_at = Date.now();
                }
              },
              false,
              'promoteToActive:success',
            );

            return finalConversationId;
          } catch (error) {
            console.error('[Zustand] promoteToActive FAILED:', error);

            // Set error state
            set(
              (state) => {
                const s = state.sessions.find((s) => s.id === sessionId);
                if (s) {
                  s.state = 'error';
                  s.promotionError = error as Error;
                }
              },
              false,
              'promoteToActive:error',
            );

            throw error;
          }
        },

        retryPromotion: async (sessionId) => {
          const session = get().sessions.find((s) => s.id === sessionId);
          if (!session || !session.messages[0]) {
            throw new Error('Cannot retry: no session or message found');
          }
          // Reset to draft and clear error
          set(
            (state) => {
              const s = state.sessions.find((s) => s.id === sessionId);
              if (s) {
                s.state = 'draft';
                s.promotionError = undefined;
              }
            },
            false,
            'retryPromotion',
          );

          throw new Error(
            'retryPromotion: Please call promoteToActive again with message and dialogId',
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

        // ✅ BEST PRACTICE: Direct assignment with Immer
        updateSessionMessages: (id, messages) =>
          set(
            (state) => {
              const session = state.sessions.find((s) => s.id === id);
              if (session) {
                session.messages = messages;
                session.updated_at = Date.now();
              }
            },
            false,
            'updateSessionMessages',
          ),

        // ✅ BEST PRACTICE: Merge params easily
        updateSessionParams: (id, params) =>
          set(
            (state) => {
              const session = state.sessions.find((s) => s.id === id);
              if (session) {
                session.params = { ...session.params, ...params };
                session.updated_at = Date.now();
              }
            },
            false,
            'updateSessionParams',
          ),

        getSessionById: (id) => {
          return get().sessions.find((s) => s.id === id);
        },

        setLoading: (isLoading) => {
          set({ isLoading }, false, 'setLoading');
        },

        // ✅ BEST PRACTICE: Toggle boolean directly
        toggleFavorite: (id) =>
          set(
            (state) => {
              const session = state.sessions.find((s) => s.id === id);
              if (session) {
                session.is_favorited = !session.is_favorited;
                session.updated_at = Date.now();
              }
            },
            false,
            'toggleFavorite',
          ),

        deleteUnfavorited: () => {
          set(
            (state) => {
              const unfavorited = state.sessions.filter(
                (s) => s.state === 'active' && !s.is_favorited,
              );
              const remaining = state.sessions.filter(
                (s) => s.state === 'draft' || s.is_favorited,
              );

              console.log(
                '[deleteUnfavorited] Deleting',
                unfavorited.length,
                'unfavorited sessions',
              );

              // Switch to draft if current session is deleted
              let newCurrentId = state.currentSessionId;
              if (unfavorited.some((s) => s.id === state.currentSessionId)) {
                const draft = remaining.find((s) => s.state === 'draft');
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
      })),
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
    {
      name: 'FreeChat_Session',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// Selectors (following Lobe Chat pattern)
export const sessionSelectors = {
  // ✅ 修复：重新实现为计算属性（原来引用了不存在的 state.currentSession）
  currentSession: (state: SessionStore) =>
    state.sessions.find((s) => s.id === state.currentSessionId),
  currentSessionId: (state: SessionStore) => state.currentSessionId,
  sessions: (state: SessionStore) => state.sessions,
  isLoading: (state: SessionStore) => state.isLoading,
  getSessionById: (id: string) => (state: SessionStore) =>
    state.getSessionById(id),
  sessionCount: (state: SessionStore) => state.sessions.length,
  hasSession: (state: SessionStore) => state.sessions.length > 0,
};
