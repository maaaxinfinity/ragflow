/**
 * FreeChat Session State Machine (Refactored - Best Practices)
 *
 * Manages the lifecycle of a session: IDLE -> DRAFT -> PROMOTING -> ACTIVE
 *
 * ✅ Refactored (2025-01-11):
 * - Simplified Context: Only state transition data, business data in Zustand
 * - Service Injection: API calls injected at runtime (testable)
 * - Single Source of Truth: Zustand stores data, XState orchestrates transitions
 * - No Polling: State-driven UI updates
 */

import type { Message } from '@/interfaces/database/chat';
import { assign, createMachine } from 'xstate';

// ==================== Context (Simplified - Best Practice) ====================

/**
 * ✅ BEST PRACTICE: Machine context should only contain state transition data
 *
 * Business data (name, messages, params) now lives in Zustand Store.
 * This eliminates dual source of truth and makes testing easier.
 */
export interface SessionContext {
  // Minimal data for state transitions
  sessionId: string;

  // Temporary data during promotion (cleared after success/failure)
  pendingConversationId?: string;
  pendingMessage?: Message;
  pendingDialogId?: string;

  // Error state
  promotionError?: Error;
}

// ==================== Events ====================

/**
 * ✅ BEST PRACTICE: Simplified events (no business data updates)
 * Business data updates now handled by Zustand actions
 */
export type SessionEvent =
  // Initialization (only sessionId needed)
  | { type: 'INIT_DRAFT'; sessionId: string }
  | { type: 'INIT_ACTIVE'; sessionId: string }

  // Promotion
  | {
      type: 'PROMOTE_TO_ACTIVE';
      message: Message;
      dialogId: string;
      modelCardId: number;
    }
  | { type: 'RETRY_PROMOTION' }

  // Deletion
  | { type: 'DELETE' };

// ==================== Type State ====================

export interface SessionTypeState {
  states: {
    idle: {};
    draft: {};
    promoting: {
      states: {
        creatingConversation: {};
        updatingSession: {};
        success: {};
        failure: {};
      };
    };
    active: {};
    deleted: {};
  };
}

// ==================== Guards ====================

const guards = {
  canRetryPromotion: ({ context }: { context: SessionContext }) =>
    !!context.pendingMessage && !!context.pendingDialogId,
};

// ==================== Actions (Simplified - Best Practice) ====================

/**
 * ✅ BEST PRACTICE: Actions only manage machine state, not business data
 *
 * Zustand store updates happen via injected actions (see useSessionMachine hook)
 */
const actions = {
  // Initialize sessions (only set sessionId)
  initializeDraft: assign({
    sessionId: ({ event }: any) => event.sessionId,
    pendingConversationId: () => undefined,
    promotionError: () => undefined,
  }),

  initializeActive: assign({
    sessionId: ({ event }: any) => event.sessionId,
    pendingConversationId: () => undefined,
    promotionError: () => undefined,
  }),

  // Promotion flow - store temporary data
  startPromotion: assign({
    promotionError: () => undefined,
    pendingMessage: ({ event }: any) => event.message,
    pendingDialogId: ({ event }: any) => event.dialogId,
    pendingModelCardId: ({ event }: any) => event.modelCardId, // ✅ Added
  }),

  // Store conversation ID from backend response
  storeConversationId: assign({
    pendingConversationId: ({ event }: any) => event.data.conversationId,
  }),

  // Clear all promotion data on success
  clearPromotionData: assign({
    pendingMessage: () => undefined,
    pendingDialogId: () => undefined,
    pendingModelCardId: () => undefined, // ✅ Added
    pendingConversationId: () => undefined,
    promotionError: () => undefined,
  }),

  // Store error on failure
  storePromotionError: assign({
    promotionError: ({ event }: any) =>
      new Error(event.error?.message || 'Promotion failed'),
    pendingConversationId: () => undefined,
  }),
};

// ==================== Services (Injected - Best Practice) ====================

/**
 * ✅ BEST PRACTICE: Service reference for runtime injection
 *
 * Actual implementation injected in useSessionMachine hook.
 * Benefits:
 * - Testable (can mock API)
 * - Reusable (different implementations)
 * - SSR-compatible (no hardcoded fetch)
 *
 * Service signature:
 * promoteDraftToActive({ context, event }) => Promise<{ conversationId: string }>
 */
export type PromoteDraftServiceInput = {
  message: Message;
  dialogId: string;
  modelCardId: number;
};

export type PromoteDraftServiceOutput = {
  conversationId: string;
};

// ==================== State Machine ====================

/**
 * ✅ Session State Machine (XState v5)
 *
 * This machine ONLY manages state transitions.
 * Business data lives in Zustand store.
 */
export const sessionMachine = createMachine(
  {
    id: 'freeChatSession',
    types: {} as {
      context: SessionContext;
      events: SessionEvent;
    },
    initial: 'idle',
    context: {
      sessionId: '',
      pendingConversationId: undefined,
      pendingMessage: undefined,
      pendingDialogId: undefined,
      pendingModelCardId: undefined, // ✅ Added
      promotionError: undefined,
    },
    states: {
      // ========== IDLE STATE ==========
      idle: {
        on: {
          INIT_DRAFT: {
            target: 'draft',
            actions: 'initializeDraft',
          },
          INIT_ACTIVE: {
            target: 'active',
            actions: 'initializeActive',
          },
        },
      },

      // ========== DRAFT STATE ==========
      draft: {
        entry: () => {
          console.log('[StateMachine] Entered DRAFT state');
        },
        on: {
          // Promote to active when user sends first message
          PROMOTE_TO_ACTIVE: {
            target: 'promoting',
            actions: 'startPromotion',
          },
        },
      },

      // ========== PROMOTING STATE ==========
      promoting: {
        entry: (ctx) => {
          console.log('[StateMachine] Entered PROMOTING state');
          console.log('[StateMachine] PROMOTING context:', {
            pendingMessage: ctx.context.pendingMessage?.content?.slice(0, 30),
            pendingDialogId: ctx.context.pendingDialogId,
            pendingModelCardId: ctx.context.pendingModelCardId,
          });
        },
        initial: 'creatingConversation',
        states: {
          creatingConversation: {
            entry: () => {
              console.log(
                '[StateMachine] Entered creatingConversation sub-state',
              );
            },
            invoke: {
              id: 'createConversation',
              // ✅ Service name reference (injected at runtime)
              src: 'promoteDraftToActive',
              // ✅ CRITICAL FIX: Read from context (stored by startPromotion action)
              input: ({ context }: any) => {
                console.log(
                  '[StateMachine] Creating invoke input from context:',
                  {
                    pendingMessage: context.pendingMessage?.content?.slice(
                      0,
                      30,
                    ),
                    pendingDialogId: context.pendingDialogId,
                    pendingModelCardId: context.pendingModelCardId,
                  },
                );
                return {
                  message: context.pendingMessage,
                  dialogId: context.pendingDialogId,
                  modelCardId: context.pendingModelCardId, // ✅ Fixed: read from context
                };
              },
              onDone: {
                target: 'success',
                actions: ['storeConversationId'],
              },
              onError: {
                target: 'failure',
                actions: ['storePromotionError'],
              },
            },
          },
          success: {
            // ✅ Transition to active immediately
            // Zustand store update happens via injected action
            always: {
              target: '#freeChatSession.active',
              actions: ['clearPromotionData'],
            },
          },
          failure: {
            entry: ({ context }) => {
              console.error(
                '[StateMachine] Promotion failed:',
                context.promotionError,
              );
            },
            on: {
              RETRY_PROMOTION: {
                target: 'creatingConversation',
                guard: 'canRetryPromotion',
              },
            },
            after: {
              // Auto-rollback to draft after 100ms
              100: {
                target: '#freeChatSession.draft',
                actions: ['clearPromotionData'],
              },
            },
          },
        },
      },

      // ========== ACTIVE STATE ==========
      active: {
        entry: () => {
          console.log('[StateMachine] Entered ACTIVE state');
        },
        on: {
          DELETE: {
            target: 'deleted',
          },
        },
      },

      // ========== DELETED STATE ==========
      deleted: {
        type: 'final',
        entry: () => {
          console.log('[StateMachine] Session deleted');
        },
      },
    },
  },
  {
    guards,
    actions,
  },
);

// ==================== Helpers ====================

/**
 * Get human-readable state name
 */
export function getStateName(state: any): string {
  if (state.matches('idle')) return 'IDLE';
  if (state.matches('draft')) return 'DRAFT';
  if (state.matches('promoting')) return 'PROMOTING';
  if (state.matches('active')) return 'ACTIVE';
  if (state.matches('deleted')) return 'DELETED';
  return 'UNKNOWN';
}

/**
 * Check if session is in a stable state (not transitioning)
 */
export function isStableState(state: any): boolean {
  return state.matches('draft') || state.matches('active');
}

/**
 * Check if session can accept user messages
 */
export function canAcceptMessages(state: any): boolean {
  return state.matches('draft') || state.matches('active');
}
