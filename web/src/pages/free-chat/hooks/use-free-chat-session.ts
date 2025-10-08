import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Message } from '@/interfaces/database/chat';

/**
 * FreeChat Session Interface - Metadata ONLY (no messages)
 * 
 * ✅ Principle 1: Separation of Concerns
 * - Sessions in this interface contain ONLY metadata
 * - Message content is stored in conversation table (Single Source of Truth)
 * - Messages are lazy-loaded on-demand when switching sessions
 * 
 * ❌ CRITICAL: The 'messages' field has been REMOVED from this interface
 * - Old architecture: IFreeChatSession.messages stored full message arrays
 * - New architecture: Messages loaded separately via GET /conversation/messages
 */
export interface IFreeChatSession {
  id: string;
  conversation_id?: string; // RAGFlow conversation ID (link to message source)
  model_card_id?: number; // Model card ID from law-workspace
  name: string;
  created_at: number;
  updated_at: number;
  message_count?: number; // ✅ NEW: Cached message count for UI display (not full messages!)
  isDraft?: boolean; // ✅ NEW: Temporary session (not saved to settings, auto-deleted on switch)
  params?: {
    temperature?: number;
    top_p?: number;
    role_prompt?: string;
  }; // User-customized parameters for this conversation (overrides model card defaults)
  // ❌ REMOVED: messages: Message[] - Now loaded separately via lazy loading
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

      if (lastSyncedCount === 0) {
        // First load: complete sync
        console.log('[useFreeChatSession] First load sync');
        setSessions(initialSessions);
        setLastSyncedCount(newCount);
        
        // Auto-select first session if none selected
        if (!currentSessionId && initialSessions.length > 0) {
          setCurrentSessionId(initialSessions[0].id);
        }
      } else if (newCount !== currentCount) {
        // Count changed: sync but preserve local conversation_id
        console.log('[useFreeChatSession] Count changed, merging local state');
        setSessions(prevSessions => {
          const mergedSessions = initialSessions.map(incomingSession => {
            const localSession = prevSessions.find(s => s.id === incomingSession.id);
            // If local has conversation_id but remote doesn't, keep local
            // This prevents loss of conversation_id during debounced save window
            if (localSession?.conversation_id && !incomingSession.conversation_id) {
              console.log('[useFreeChatSession] Preserving local conversation_id for session:', incomingSession.id);
              return { ...incomingSession, conversation_id: localSession.conversation_id };
            }
            return incomingSession;
          });
          return mergedSessions;
        });
        setLastSyncedCount(newCount);
      } else {
        // Count unchanged: skip sync to preserve local modifications
        console.log('[useFreeChatSession] Skipping sync to preserve local changes');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessions]);

  // Save sessions callback
  // IMPORTANT: Filter out draft sessions (temporary, not persisted)
  const saveSessions = useCallback(
    (newSessions: IFreeChatSession[]) => {
      // Only save non-draft sessions to settings
      const persistentSessions = newSessions.filter(s => !s.isDraft);
      console.log('[useFreeChatSession] Saving sessions - total:', newSessions.length, 'persistent:', persistentSessions.length);
      onSessionsChange?.(persistentSessions);
    },
    [onSessionsChange],
  );

  // Get current session
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // BUG FIX #3: Use functional setState to avoid closure issues
  // Create new session
  // isDraft: true = temporary session (not saved, auto-deleted on switch)
  const createSession = useCallback((name?: string, model_card_id?: number, isDraft: boolean = false) => {
    let newSession: IFreeChatSession;

    setSessions(prevSessions => {
      // Clean up existing draft session if creating a new one
      const filteredSessions = isDraft 
        ? prevSessions.filter(s => !s.isDraft)
        : prevSessions;

      newSession = {
        id: uuid(),
        name: name || '新对话',
        model_card_id,
        created_at: Date.now(),
        updated_at: Date.now(),
        isDraft,  // Mark as draft if specified
      };
      const updatedSessions = [newSession, ...filteredSessions];
      saveSessions(updatedSessions);  // saveSessions will filter out drafts
      return updatedSessions;
    });

    setCurrentSessionId(newSession!.id);
    console.log('[useFreeChatSession] Created session:', newSession!.id, 'isDraft:', isDraft);
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
  const deleteSession = useCallback((sessionId: string, options?: { skipSave?: boolean }) => {
    let shouldUpdateCurrentId = false;
    let newCurrentId = '';

    setSessions(prevSessions => {
      const updatedSessions = prevSessions.filter(s => s.id !== sessionId);
      
      // Save unless explicitly skipped (used for draft cleanup)
      if (!options?.skipSave) {
        saveSessions(updatedSessions);
      }

      // Check if we need to update current session ID
      if (sessionId === currentSessionId) {
        shouldUpdateCurrentId = true;
        // Switch to first non-draft session if available
        const nonDraftSession = updatedSessions.find(s => !s.isDraft);
        if (nonDraftSession) {
          newCurrentId = nonDraftSession.id;
        } else if (updatedSessions.length > 0) {
          newCurrentId = updatedSessions[0].id;
        }
      }

      return updatedSessions;
    });

    // Update current session ID if needed
    if (shouldUpdateCurrentId) {
      setCurrentSessionId(newCurrentId);
    }
    console.log('[useFreeChatSession] Deleted session:', sessionId);
  }, [currentSessionId, saveSessions]);

  // BUG FIX #11: Switch session without closure dependency
  // Auto-cleanup draft sessions when switching
  const switchSession = useCallback((sessionId: string) => {
    setSessions(prevSessions => {
      const targetSession = prevSessions.find(s => s.id === sessionId);
      if (targetSession) {
        // Clean up old draft sessions (except the one we're switching to)
        const cleanedSessions = prevSessions.filter(s => 
          !s.isDraft || s.id === sessionId
        );
        
        setCurrentSessionId(sessionId);
        console.log('[useFreeChatSession] Switched to session:', sessionId, 'isDraft:', targetSession.isDraft);
        
        // If cleaned any drafts, save the updated list
        if (cleanedSessions.length !== prevSessions.length) {
          console.log('[useFreeChatSession] Cleaned up', prevSessions.length - cleanedSessions.length, 'draft sessions');
          saveSessions(cleanedSessions);
          return cleanedSessions;
        }
        return prevSessions;
      }
      return prevSessions;
    });
  }, [saveSessions]);

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
