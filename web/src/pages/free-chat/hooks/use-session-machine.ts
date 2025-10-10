/**
 * useSessionMachine Hook (Simplified - No XState)
 *
 * ✅ Refactored (2025-01-11):
 * - Removed XState dependency - now uses pure Zustand
 * - Simple state management with computed properties
 * - Direct access to promoteToActive action from store
 *
 * This hook provides session state information and promotion actions
 * without the complexity of a state machine library.
 */

import type { Message } from '@/interfaces/database/chat';
import { useMemo } from 'react';
import { useSessionStore } from '../store/session';

interface UseSessionMachineProps {
  // Session ID to manage
  sessionId: string;

  // Callback when session is promoted to active (optional)
  onPromotionSuccess?: (conversationId: string) => void;

  // Callback when promotion fails (optional)
  onPromotionFailure?: (error: Error) => void;
}

/**
 * ✅ SIMPLIFIED: Hook that provides session state and promotion actions
 */
export function useSessionMachine(props: UseSessionMachineProps) {
  const { sessionId, onPromotionSuccess, onPromotionFailure } = props;

  // Get session from Zustand store
  const session = useSessionStore((state) =>
    state.sessions.find((s) => s.id === sessionId),
  );

  // Get store actions
  const promoteToActiveStore = useSessionStore(
    (state) => state.promoteToActive,
  );
  const retryPromotionStore = useSessionStore((state) => state.retryPromotion);

  // Computed state properties
  const isDraft = session?.state === 'draft';
  const isPromoting = session?.state === 'promoting';
  const isActive = session?.state === 'active';
  const isError = session?.state === 'error';
  const canSendMessage = isDraft || isActive;

  // Current state name (for debugging/display)
  const currentState = session?.state?.toUpperCase() || 'UNKNOWN';

  // Promotion action wrapper
  const promoteToActive = useMemo(
    () => async (message: Message, dialogId: string, userId?: string) => {
      if (!session) {
        console.error('[useSessionMachine] No session found');
        return;
      }

      try {
        console.log('[useSessionMachine] Promoting draft to active:', {
          sessionId,
          dialogId,
          userId,
        });

        const conversationId = await promoteToActiveStore(
          sessionId,
          message,
          dialogId,
          userId,
        );

        console.log('[useSessionMachine] Promotion success:', conversationId);
        onPromotionSuccess?.(conversationId);
      } catch (error) {
        console.error('[useSessionMachine] Promotion failed:', error);
        onPromotionFailure?.(error as Error);
      }
    },
    [
      sessionId,
      session,
      promoteToActiveStore,
      onPromotionSuccess,
      onPromotionFailure,
    ],
  );

  // Retry promotion action
  const retryPromotion = useMemo(
    () => async () => {
      try {
        await retryPromotionStore(sessionId);
      } catch (error) {
        console.error('[useSessionMachine] Retry failed:', error);
        onPromotionFailure?.(error as Error);
      }
    },
    [sessionId, retryPromotionStore, onPromotionFailure],
  );

  return {
    // State properties
    sessionId,
    currentState,
    isDraft,
    isPromoting,
    isActive,
    isError,
    canSendMessage,
    promotionError: session?.promotionError,

    // Actions
    promoteToActive,
    retryPromotion,

    // Raw session data (for compatibility)
    session,
  };
}

// Helper function for checking if session can accept messages
export function canAcceptMessages(state: string | undefined): boolean {
  return state === 'draft' || state === 'active';
}

// Helper function for getting readable state name
export function getStateName(state: string | undefined): string {
  if (!state) return 'UNKNOWN';
  return state.toUpperCase();
}
