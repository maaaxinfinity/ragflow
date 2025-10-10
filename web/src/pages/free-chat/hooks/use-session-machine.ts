/**
 * useSessionMachine Hook (Refactored - Best Practices)
 *
 * ✅ Refactored (2025-01-11):
 * - Uses useActor instead of useMachine + manual subscription
 * - Injects services at runtime (testable)
 * - Injects actions to update Zustand store (single source of truth)
 * - No business data in machine context
 *
 * React hook wrapper for the session state machine.
 * XState manages state transitions, Zustand stores data.
 */

import type { Message } from '@/interfaces/database/chat';
import { useMachine } from '@xstate/react';
import { useCallback, useEffect, useMemo } from 'react';
import { fromPromise } from 'xstate';
import {
  canAcceptMessages,
  getStateName,
  sessionMachine,
} from '../machines/session-machine';
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
 * ✅ BEST PRACTICE: Hook that connects XState machine to Zustand store
 */
export function useSessionMachine(props: UseSessionMachineProps) {
  const { sessionId, onPromotionSuccess, onPromotionFailure } = props;

  // Get Zustand store actions
  const updateSession = useSessionStore((state) => state.updateSession);
  const getSessionById = useSessionStore((state) => state.getSessionById);

  // Get session data from Zustand (single source of truth)
  const session = useMemo(
    () => getSessionById(sessionId),
    [getSessionById, sessionId],
  );

  // ✅ BEST PRACTICE: Inject service implementation
  const promoteDraftService = useCallback(async ({ input }: { input: any }) => {
    console.log('[promoteDraftService] INVOKED! Raw input:', input);

    const { message, dialogId, modelCardId } = input;

    console.log('[promoteDraftService] START - Creating conversation:', {
      dialogId,
      modelCardId,
      messageSample: message?.content?.slice(0, 30),
    });

    try {
      const response = await fetch('/v1/conversation/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          dialog_id: dialogId,
          name: message.content.slice(0, 50),
          is_new: true,
          model_card_id: modelCardId,
          message: [{ role: 'assistant', content: '' }],
        }),
      });

      console.log('[promoteDraftService] Response status:', response.status);

      const result = await response.json();

      console.log('[promoteDraftService] Response data:', result);

      if (result.code !== 0) {
        console.error('[promoteDraftService] FAILED:', result.message);
        throw new Error(result.message || '创建对话失败');
      }

      console.log(
        '[promoteDraftService] SUCCESS - conversation_id:',
        result.data.id,
      );

      return {
        conversationId: result.data.id,
      };
    } catch (error) {
      console.error('[promoteDraftService] ERROR:', error);
      throw error;
    }
  }, []);

  // ✅ BEST PRACTICE: Use useMachine with injected services
  // Note: useMachine (not useActor) is correct for creating new actor instances
  const [state, send] = useMachine(sessionMachine, {
    input: {
      sessionId,
    },
    actors: {
      // ✅ FIX: Proper fromPromise wrapping with explicit typing
      promoteDraftToActive: fromPromise<
        { conversationId: string },
        { message: any; dialogId: string; modelCardId: number }
      >(promoteDraftService),
    },
  });

  // Debug: confirm machine is initialized
  console.log('[useSessionMachine] Machine created with actors:', {
    hasPromoteDraftService: !!promoteDraftService,
  });

  // ✅ Initialize machine based on session state
  useEffect(() => {
    if (!session) return;

    // Only initialize if in idle state
    if (!state.matches('idle')) return;

    console.log(
      '[useSessionMachine] Initializing machine for session:',
      sessionId,
    );

    if (session.conversation_id) {
      // Active session
      console.log('[useSessionMachine] → INIT_ACTIVE');
      send({ type: 'INIT_ACTIVE', sessionId: session.id });
    } else {
      // Draft session
      console.log('[useSessionMachine] → INIT_DRAFT');
      send({ type: 'INIT_DRAFT', sessionId: session.id });
    }
  }, [sessionId, session?.conversation_id, send]); // ✅ Fixed: only re-init when sessionId or conversation_id changes

  // ✅ BEST PRACTICE: Update Zustand store on promotion success
  // ✅ 优化：使用精确的依赖项（state.value 和 state.context.xxx）
  useEffect(() => {
    const isActive = state.matches('active');
    const conversationId = state.context.pendingConversationId;

    if (isActive && conversationId) {
      console.log(
        '[useSessionMachine] Promotion succeeded, updating Zustand:',
        conversationId,
      );

      // Update Zustand store (single source of truth)
      updateSession(sessionId, {
        conversation_id: conversationId,
        state: 'active',
      });

      // Notify callback
      if (onPromotionSuccess) {
        onPromotionSuccess(conversationId);
      }
    }
  }, [
    state.value, // ✅ 精确依赖：只在状态值变化时触发
    state.context.pendingConversationId, // ✅ 精确依赖：只在这个字段变化时触发
    sessionId,
    updateSession,
    onPromotionSuccess,
  ]);

  // ✅ Handle promotion failure
  // ✅ 优化：使用精确的依赖项
  useEffect(() => {
    const isFailure = state.matches('promoting.failure');
    const error = state.context.promotionError;

    if (isFailure && error) {
      console.error('[useSessionMachine] Promotion failed:', error);

      // Notify callback
      if (onPromotionFailure) {
        onPromotionFailure(error);
      }
    }
  }, [
    state.value, // ✅ 精确依赖
    state.context.promotionError, // ✅ 精确依赖
    onPromotionFailure,
  ]);

  // 🔧 DEBUG: Log actor state to understand why invoke isn't firing
  useEffect(() => {
    console.log('[useSessionMachine] State changed:', {
      value: state.value,
      matches_promoting: state.matches('promoting'),
      matches_creating: state.matches('promoting.creatingConversation'),
      context: state.context,
    });
  }, [state.value, state.context]);

  // ========== Actions (Simplified) ==========

  /**
   * ✅ Promote draft to active
   * This triggers backend conversation creation and state transition.
   * Business data (messages) stays in Zustand throughout the process.
   */
  const promoteToActive = useCallback(
    (message: Message, dialogId: string, modelCardId: number) => {
      console.log('[useSessionMachine] Promoting to active:', {
        sessionId,
        messageSample: message.content.slice(0, 30),
      });

      send({
        type: 'PROMOTE_TO_ACTIVE',
        message,
        dialogId,
        modelCardId,
      });
    },
    [send, sessionId],
  );

  /**
   * ✅ Retry failed promotion
   */
  const retryPromotion = useCallback(() => {
    console.log(
      '[useSessionMachine] Retrying promotion for session:',
      sessionId,
    );
    send({ type: 'RETRY_PROMOTION' });
  }, [send, sessionId]);

  /**
   * ✅ Delete session
   */
  const deleteSession = useCallback(() => {
    console.log('[useSessionMachine] Deleting session:', sessionId);
    send({ type: 'DELETE' });
  }, [send, sessionId]);

  // ========== Computed State (from Machine) ==========

  const currentState = getStateName(state);
  const isDraft = state.matches('draft');
  const isPromoting = state.matches('promoting');
  const isActive = state.matches('active');
  const isDeleted = state.matches('deleted');
  const canSendMessages = canAcceptMessages(state);

  // Debug: log state changes
  useEffect(() => {
    console.log('[useSessionMachine] State changed:', {
      sessionId,
      currentState,
      isDraft,
      isPromoting,
      isActive,
      conversationId: state.context.pendingConversationId,
    });
  }, [
    sessionId,
    currentState,
    isDraft,
    isPromoting,
    isActive,
    state.context.pendingConversationId,
  ]);

  // ✅ Return minimal interface - data comes from Zustand, not machine
  return {
    // Machine state (read-only)
    currentState,
    isDraft,
    isPromoting,
    isActive,
    isDeleted,
    canSendMessages,

    // Error state (from machine)
    error: state.context.promotionError,

    // Actions (state transitions only)
    promoteToActive,
    retryPromotion,
    deleteSession,

    // Raw state machine (for debugging)
    state,
    send,
  };
}
