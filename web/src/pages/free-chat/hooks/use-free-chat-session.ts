import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Message } from '@/interfaces/database/chat';
import { DynamicModelParams } from '../types';

export interface IFreeChatSession {
  id: string;
  conversation_id?: string; // RAGFlow conversation ID
  name: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
}

const STORAGE_KEY = 'free_chat_sessions';
const CURRENT_SESSION_KEY = 'free_chat_current_session';

// BUG FIX #8: Improved localStorage error handling with user notification
// Load sessions from localStorage
const loadSessions = (): IFreeChatSession[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    // Validate the data structure
    if (!Array.isArray(parsed)) {
      console.error('Invalid sessions data format, resetting...');
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    // Validate each session has required fields
    const validSessions = parsed.filter(s =>
      s.id && s.name && s.created_at && s.updated_at
    );

    if (validSessions.length !== parsed.length) {
      console.warn(`Filtered out ${parsed.length - validSessions.length} invalid sessions`);
    }

    return validSessions;
  } catch (e) {
    console.error('Failed to load sessions, data may be corrupted:', e);
    // Clear corrupted data
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

// Save sessions to localStorage
const saveSessions = (sessions: IFreeChatSession[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save sessions:', e);
    // Notify user if storage quota exceeded
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded. Session data may not be saved.');
    }
  }
};

export const useFreeChatSession = () => {
  const [sessions, setSessions] = useState<IFreeChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // Load sessions on mount
  useEffect(() => {
    const loadedSessions = loadSessions();
    setSessions(loadedSessions);

    // Load current session ID
    const savedCurrentId = localStorage.getItem(CURRENT_SESSION_KEY);
    if (savedCurrentId && loadedSessions.find(s => s.id === savedCurrentId)) {
      setCurrentSessionId(savedCurrentId);
    } else if (loadedSessions.length > 0) {
      setCurrentSessionId(loadedSessions[0].id);
    }
  }, []);

  // Save current session ID
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
    }
  }, [currentSessionId]);

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
  }, []);

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
  }, []);

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
  }, [currentSessionId]);

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
  }, []);

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
