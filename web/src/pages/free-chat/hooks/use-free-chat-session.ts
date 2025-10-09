/**
 * useFreeChatSession Hook
 * 
 * Refactored to use Zustand store for state management
 * This hook now acts as a wrapper around the sessionStore
 * Maintains backward compatibility with existing components
 */

import { useCallback, useEffect } from 'react';
import { Message } from '@/interfaces/database/chat';
import { useSessionStore, IFreeChatSession } from '../store/session';

interface UseFreeChatSessionProps {
  initialSessions?: IFreeChatSession[];
  onSessionsChange?: (sessions: IFreeChatSession[]) => void;
}

export type { IFreeChatSession };

export const useFreeChatSession = (props?: UseFreeChatSessionProps) => {
  const { initialSessions, onSessionsChange } = props || {};
  
  // Get state and actions from Zustand store
  const sessions = useSessionStore((state) => state.sessions);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const currentSession = useSessionStore((state) => state.currentSession);
  
  const setSessions = useSessionStore((state) => state.setSessions);
  const setCurrentSessionId = useSessionStore((state) => state.setCurrentSessionId);
  const createSession = useSessionStore((state) => state.createSession);
  const updateSession = useSessionStore((state) => state.updateSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const switchSession = useSessionStore((state) => state.switchSession);
  const clearAllSessions = useSessionStore((state) => state.clearAllSessions);

  // Initialize from props on mount
  useEffect(() => {
    if (initialSessions && initialSessions.length > 0) {
      console.log('[useFreeChatSession] Initializing sessions from props:', initialSessions.length);
      setSessions(initialSessions);
      
      // Auto-select first session if none selected
      if (!currentSessionId && initialSessions[0]) {
        setCurrentSessionId(initialSessions[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Trigger callback when sessions change
  useEffect(() => {
    if (sessions.length > 0 && onSessionsChange) {
      console.log('[useFreeChatSession] Sessions changed, calling onSessionsChange');
      onSessionsChange(sessions);
    }
  }, [sessions, onSessionsChange]);

  // Wrap createSession to maintain backward compatibility
  const wrappedCreateSession = useCallback((name?: string, model_card_id?: number) => {
    console.log('[useFreeChatSession] Creating new session:', { name, model_card_id });
    return createSession(name, model_card_id);
  }, [createSession]);

  return {
    sessions,
    currentSession,
    currentSessionId,
    createSession: wrappedCreateSession,
    updateSession,
    deleteSession,
    switchSession,
    clearAllSessions,
  };
};
