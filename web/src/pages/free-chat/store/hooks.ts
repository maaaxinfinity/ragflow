/**
 * Optimized Hooks for FreeChat Stores
 * 
 * These hooks use useShallow to prevent unnecessary re-renders
 * Use these instead of directly calling useSessionStore/useMessageStore
 */

import { useShallow } from 'zustand/react/shallow';
import { useSessionStore, sessionSelectors } from './session';
import { useMessageStore, messageSelectors } from './message';

// ============= Session Hooks =============

/**
 * Get current session (optimized)
 * Only re-renders when currentSession actually changes
 */
export const useCurrentSession = () => {
  return useSessionStore(sessionSelectors.currentSession);
};

/**
 * Get all sessions (optimized)
 * Only re-renders when sessions array changes
 */
export const useSessions = () => {
  return useSessionStore(sessionSelectors.sessions);
};

/**
 * Get current session ID (optimized)
 */
export const useCurrentSessionId = () => {
  return useSessionStore(sessionSelectors.currentSessionId);
};

/**
 * Get session count (optimized)
 * Only re-renders when count changes, not when session contents change
 */
export const useSessionCount = () => {
  return useSessionStore(sessionSelectors.sessionCount);
};

/**
 * Check if has any session (optimized)
 */
export const useHasSession = () => {
  return useSessionStore(sessionSelectors.hasSession);
};

/**
 * Get specific session by ID (optimized)
 */
export const useSessionById = (id: string) => {
  return useSessionStore(sessionSelectors.getSessionById(id));
};

/**
 * Get session actions (stable references, won't cause re-render)
 */
export const useSessionActions = () => {
  return useSessionStore(
    useShallow((state) => ({
      createSession: state.createSession,
      updateSession: state.updateSession,
      deleteSession: state.deleteSession,
      switchSession: state.switchSession,
      clearAllSessions: state.clearAllSessions,
      duplicateSession: state.duplicateSession,
      updateSessionMessages: state.updateSessionMessages,
      updateSessionParams: state.updateSessionParams,
    }))
  );
};

/**
 * Get multiple session state values (optimized)
 * Use this when you need multiple values from the store
 */
export const useSessionState = () => {
  return useSessionStore(
    useShallow((state) => ({
      sessions: state.sessions,
      currentSessionId: state.currentSessionId,
      currentSession: state.currentSession,
      isLoading: state.isLoading,
    }))
  );
};

// ============= Message Hooks =============

/**
 * Get messages for specific session (optimized)
 */
export const useMessages = (sessionId: string) => {
  return useMessageStore(messageSelectors.getMessages(sessionId));
};

/**
 * Check if session has messages (optimized)
 */
export const useHasMessages = (sessionId: string) => {
  return useMessageStore(messageSelectors.hasMessages(sessionId));
};

/**
 * Get message count for session (optimized)
 */
export const useMessageCount = (sessionId: string) => {
  return useMessageStore(messageSelectors.messageCount(sessionId));
};

/**
 * Get message actions (stable references, won't cause re-render)
 */
export const useMessageActions = () => {
  return useMessageStore(
    useShallow((state) => ({
      setMessages: state.setMessages,
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      removeMessage: state.removeMessage,
      clearMessages: state.clearMessages,
      addUserMessage: state.addUserMessage,
      addAssistantMessage: state.addAssistantMessage,
      updateLastAssistantMessage: state.updateLastAssistantMessage,
      removeLatestMessage: state.removeLatestMessage,
    }))
  );
};

// ============= Combined Hooks =============

/**
 * Get current session with messages (optimized)
 * Useful for chat interface
 */
export const useCurrentSessionWithMessages = () => {
  const currentSessionId = useCurrentSessionId();
  const currentSession = useCurrentSession();
  const messages = useMessages(currentSessionId);
  
  return {
    session: currentSession,
    sessionId: currentSessionId,
    messages,
  };
};

/**
 * Get everything needed for chat (optimized)
 * Use this in main chat component
 */
export const useChatState = () => {
  const currentSessionId = useCurrentSessionId();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
  const messages = useMessages(currentSessionId);
  const sessionActions = useSessionActions();
  const messageActions = useMessageActions();
  
  return {
    // State
    currentSessionId,
    currentSession,
    sessions,
    messages,
    
    // Actions
    ...sessionActions,
    ...messageActions,
  };
};

/**
 * Performance monitoring hook (development only)
 */
export const usePerformanceMonitor = (componentName: string) => {
  if (process.env.NODE_ENV === 'development') {
    const renderCount = useSessionStore((state) => {
      console.log(`[Perf] ${componentName} rendered`, {
        sessionCount: state.sessions.length,
        currentSessionId: state.currentSessionId,
      });
      return 0;
    });
    
    return renderCount;
  }
  return 0;
};
