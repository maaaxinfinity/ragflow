import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Message } from '@/interfaces/database/chat';

export interface IFreeChatSession {
  id: string;
  conversation_id?: string; // RAGFlow conversation ID
  name: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
}

interface UseFreeChatSessionProps {
  initialSessions?: IFreeChatSession[];
  onSessionsChange?: (sessions: IFreeChatSession[]) => void;
}

export const useFreeChatSession = (props?: UseFreeChatSessionProps) => {
  const { initialSessions, onSessionsChange } = props || {};
  const [sessions, setSessions] = useState<IFreeChatSession[]>(
    initialSessions || [],
  );
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // Sync with external sessions changes
  // Only sync when sessions count changes (add/delete) to avoid overwriting local renames
  const [lastSyncedCount, setLastSyncedCount] = useState(0);
  useEffect(() => {
    if (initialSessions) {
      const newCount = initialSessions.length;
      const currentCount = sessions.length;

      // Only sync if:
      // 1. First load (lastSyncedCount === 0)
      // 2. Sessions count changed (add/delete operations)
      if (lastSyncedCount === 0 || newCount !== currentCount) {
        console.log('[useFreeChatSession] Syncing with initialSessions:', {
          reason: lastSyncedCount === 0 ? 'first_load' : 'count_changed',
          oldCount: currentCount,
          newCount,
        });
        setSessions(initialSessions);
        setLastSyncedCount(newCount);

        // Auto-select first session if none selected
        if (!currentSessionId && initialSessions.length > 0) {
          setCurrentSessionId(initialSessions[0].id);
        }
      } else {
        console.log('[useFreeChatSession] Skipping sync to preserve local changes');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessions]);

  // Save sessions callback
  const saveSessions = useCallback(
    (newSessions: IFreeChatSession[]) => {
      onSessionsChange?.(newSessions);
    },
    [onSessionsChange],
  );

  // Get current session
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // BUG FIX #3: Use functional setState to avoid closure issues
  // Create new session
  const createSession = useCallback((name?: string) => {
    let newSession: IFreeChatSession;

    setSessions(prevSessions => {
      newSession = {
        id: uuid(),
        name: name || `Chat ${prevSessions.length + 1}`,
        messages: [],
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      const updatedSessions = [newSession, ...prevSessions];
      saveSessions(updatedSessions);
      return updatedSessions;
    });

    setCurrentSessionId(newSession!.id);
    return newSession!;
  }, [saveSessions]);

  // Update session
  const updateSession = useCallback((sessionId: string, updates: Partial<IFreeChatSession>) => {
    setSessions(prevSessions => {
      const updatedSessions = prevSessions.map(s =>
        s.id === sessionId
          ? { ...s, ...updates, updated_at: Date.now() }
          : s
      );
      saveSessions(updatedSessions);
      return updatedSessions;
    });
  }, [saveSessions]);

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    let shouldUpdateCurrentId = false;
    let newCurrentId = '';

    setSessions(prevSessions => {
      const updatedSessions = prevSessions.filter(s => s.id !== sessionId);
      saveSessions(updatedSessions);

      // Check if we need to update current session ID
      if (sessionId === currentSessionId) {
        shouldUpdateCurrentId = true;
        if (updatedSessions.length > 0) {
          newCurrentId = updatedSessions[0].id;
        }
      }

      return updatedSessions;
    });

    // Update current session ID if needed
    if (shouldUpdateCurrentId) {
      setCurrentSessionId(newCurrentId);
    }
  }, [currentSessionId, saveSessions]);

  // BUG FIX #11: Switch session without closure dependency
  const switchSession = useCallback((sessionId: string) => {
    setSessions(prevSessions => {
      if (prevSessions.find(s => s.id === sessionId)) {
        setCurrentSessionId(sessionId);
      }
      return prevSessions; // No change to sessions
    });
  }, []);

  // Clear all sessions
  const clearAllSessions = useCallback(() => {
    setSessions([]);
    saveSessions([]);
    setCurrentSessionId('');
  }, [saveSessions]);

  return {
    sessions,
    currentSession,
    currentSessionId,
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    clearAllSessions,
  };
};
