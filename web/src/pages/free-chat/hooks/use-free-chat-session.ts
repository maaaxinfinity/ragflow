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

// Load sessions from localStorage
const loadSessions = (): IFreeChatSession[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to load sessions:', e);
    return [];
  }
};

// Save sessions to localStorage
const saveSessions = (sessions: IFreeChatSession[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save sessions:', e);
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

  // Create new session
  const createSession = useCallback((name?: string) => {
    const newSession: IFreeChatSession = {
      id: uuid(),
      name: name || `Chat ${sessions.length + 1}`,
      messages: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    saveSessions(updatedSessions);
    setCurrentSessionId(newSession.id);

    return newSession;
  }, [sessions]);

  // Update session
  const updateSession = useCallback((sessionId: string, updates: Partial<IFreeChatSession>) => {
    const updatedSessions = sessions.map(s =>
      s.id === sessionId
        ? { ...s, ...updates, updated_at: Date.now() }
        : s
    );
    setSessions(updatedSessions);
    saveSessions(updatedSessions);
  }, [sessions]);

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    saveSessions(updatedSessions);

    // If deleting current session, switch to another
    if (sessionId === currentSessionId) {
      if (updatedSessions.length > 0) {
        setCurrentSessionId(updatedSessions[0].id);
      } else {
        setCurrentSessionId('');
      }
    }
  }, [sessions, currentSessionId]);

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    if (sessions.find(s => s.id === sessionId)) {
      setCurrentSessionId(sessionId);
    }
  }, [sessions]);

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
