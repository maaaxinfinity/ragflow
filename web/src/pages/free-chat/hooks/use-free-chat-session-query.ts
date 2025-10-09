import { useCallback, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuid } from 'uuid';
import { Message } from '@/interfaces/database/chat';
import api from '@/utils/api';
import { useSearchParams } from 'umi';

export interface IFreeChatSession {
  id: string;
  conversation_id?: string;  // Only exists after first message sent
  model_card_id?: number;
  name: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
  state?: 'draft' | 'active' | 'archived';  // draft = temporary, not persisted to backend
  params?: {
    temperature?: number;
    top_p?: number;
    role_prompt?: string;
  };
}

interface UseFreeChatSessionQueryProps {
  userId?: string;
  dialogId?: string;
  enabled?: boolean;
}

export const useFreeChatSessionQuery = (props: UseFreeChatSessionQueryProps) => {
  const { userId, dialogId, enabled = true } = props;
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // Fetch sessions from backend using TanStack Query
  const { 
    data: sessions = [], 
    isLoading, 
    refetch: originalRefetch 
  } = useQuery({
    queryKey: ['freeChatSessions', userId, dialogId],
    enabled: enabled && !!userId && !!dialogId,
    queryFn: async () => {
      const authToken = searchParams.get('auth');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const url = `${api.conversation_list}?dialog_id=${dialogId}&user_id=${userId}`;
      console.log('[useFreeChatSessionQuery] Fetching sessions from:', url);
      
      const response = await fetch(url, {
        headers,
        credentials: 'include',
      });
      
      const result = await response.json();
      console.log('[useFreeChatSessionQuery] Loaded sessions:', result.data?.length || 0);
      
      if (result.code === 0) {
        // FIX: Ensure all sessions from backend have state='active'
        // Backend doesn't return state field, so we set it explicitly
        const sessions = (result.data || []).map((session: IFreeChatSession) => ({
          ...session,
          state: session.state || 'active',  // Default to active for backend sessions
        }));
        return sessions;
      }
      throw new Error(result.message || 'Failed to load sessions');
    },
    // Smart caching and refresh strategy
    staleTime: 5 * 60 * 1000,  // 5 minutes - data considered fresh
    gcTime: 10 * 60 * 1000,    // 10 minutes - cache retention (renamed from cacheTime in v5)
    refetchOnWindowFocus: false,  // FIX: Disable auto-refresh on focus (causing infinite fetch)
    refetchOnReconnect: false,    // FIX: Disable auto-refresh on reconnect
    refetchInterval: false,       // FIX: Explicitly disable polling
    retry: 1,                     // Only retry once on error
  });

  // Custom refetch that preserves draft sessions
  const refetchSessions = useCallback(async () => {
    console.log('[refetchSessions] Starting refetch, preserving drafts...');
    
    // Get current cache before refetch
    const currentCache = queryClient.getQueryData(['freeChatSessions', userId, dialogId]) as IFreeChatSession[] || [];
    const drafts = currentCache.filter(s => s.state === 'draft');
    
    // Perform refetch
    const result = await originalRefetch();
    
    // STEP 4 FIX: Simplified Draft merging logic
    // If there were drafts, merge them back directly
    // No deduplication needed: Draft→Active conversion atomically deletes Draft
    if (drafts.length > 0 && result.data) {
      console.log('[refetchSessions] Merging', drafts.length, 'draft(s) back into cache');
      
      const activeSessions = result.data as IFreeChatSession[];
      
      queryClient.setQueryData(
        ['freeChatSessions', userId, dialogId],
        [...drafts, ...activeSessions]
      );
    }
    
    return result;
  }, [originalRefetch, queryClient, userId, dialogId]);

  // Get current session
  const currentSession = sessions.find((s: IFreeChatSession) => s.id === currentSessionId);

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async ({ 
      name, 
      model_card_id, 
      isDraft = false,
      conversationId
    }: { 
      name?: string; 
      model_card_id?: number; 
      isDraft?: boolean;
      conversationId?: string;
    }) => {
      if (!model_card_id) {
        throw new Error('model_card_id is required');
      }

      // FIX: Draft sessions should never reach here (handled in wrapper)
      // This is a safety check in case isDraft=true slips through
      if (isDraft) {
        throw new Error('[CreateSession] Draft sessions should be created in wrapper, not mutation');
      }

      // Non-draft: create on backend immediately
      if (!dialogId) {
        throw new Error('dialog_id is required for non-draft session');
      }

      // Use provided conversationId or generate new one (for Draft promotion)
      const finalConversationId = conversationId || uuid();

      const authToken = searchParams.get('auth');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/v1/conversation/set', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          conversation_id: finalConversationId,
          dialog_id: dialogId,
          user_id: userId,
          name: name || '新对话',
          is_new: true,
          model_card_id,
          message: [{ role: 'assistant', content: '' }],
        }),
      });

      const result = await response.json();
      if (result.code !== 0) {
        throw new Error(result.message || 'Failed to create session');
      }

      return {
        ...result.data,
        id: finalConversationId,
        conversation_id: finalConversationId,
        state: 'active',
      } as IFreeChatSession;
    },
    onSuccess: (newSession) => {
      console.log('[CreateSession] Active session created:', newSession);
      
      // Add to cache
      queryClient.setQueryData(
        ['freeChatSessions', userId, dialogId],
        (old: IFreeChatSession[] = []) => {
          console.log('[CreateSession] Adding session to cache, old sessions:', old.length);
          return [newSession, ...old];
        }
      );
      
      // Switch to new session
      setCurrentSessionId(newSession.id);
      console.log('[CreateSession] Switched to session:', newSession.id);
      
      // Background refresh
      setTimeout(() => {
        console.log('[CreateSession] Triggering background refresh');
        refetchSessions();
      }, 500);
    },
  });

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ 
      sessionId, 
      updates 
    }: { 
      sessionId: string; 
      updates: Partial<IFreeChatSession>;
    }) => {
      // Only sync certain fields to backend (name, messages not needed - handled by completion)
      if (updates.name !== undefined) {
        const authToken = searchParams.get('auth');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        await fetch('/v1/conversation/set', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            conversation_id: sessionId,
            is_new: false,
            name: updates.name,
          }),
        });
      }

      return { sessionId, updates };
    },
    onMutate: async ({ sessionId, updates }) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['freeChatSessions', userId, dialogId] });

      // Get previous state to detect draft -> active transition
      const previous = queryClient.getQueryData(['freeChatSessions', userId, dialogId]) as IFreeChatSession[] || [];
      const previousSession = previous.find(s => s.id === sessionId);
      
      // Optimistic update
      queryClient.setQueryData(
        ['freeChatSessions', userId, dialogId],
        (old: IFreeChatSession[] = []) => {
          return old.map(s => 
            s.id === sessionId 
              ? { ...s, ...updates, updated_at: Date.now() }
              : s
          );
        }
      );

      return { previous, wasDraft: previousSession?.state === 'draft' };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          ['freeChatSessions', userId, dialogId],
          context.previous
        );
      }
      console.error('[UpdateSession] Error:', err);
    },
    onSettled: (data, error, variables, context) => {
      // FIX: Don't refetch if updating a draft session (local-only)
      // EXCEPTION: If promoting draft to active, DO refetch to sync with backend
      
      // If promoting draft to active (detected by context.wasDraft and updates.state)
      if (context?.wasDraft && variables.updates.state === 'active') {
        console.log('[UpdateSession] Draft promoted to active, triggering refetch');
        setTimeout(() => refetchSessions(), 1000);
        return;
      }
      
      // If still draft (updates don't include state change), skip refetch
      if (context?.wasDraft && !variables.updates.state) {
        console.log('[UpdateSession] Skipping refetch for draft session (local-only)');
        return;
      }
      
      // Background refresh for active sessions
      setTimeout(() => refetchSessions(), 1000);
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      console.log('[DeleteSession] Starting deletion for session:', sessionId);
      
      // FIX: Check if session is draft (local only)
      const allSessions = queryClient.getQueryData(['freeChatSessions', userId, dialogId]) as IFreeChatSession[] || [];
      const session = allSessions.find(s => s.id === sessionId);
      
      console.log('[DeleteSession] Session found in cache:', !!session);
      console.log('[DeleteSession] Session state:', session?.state);
      console.log('[DeleteSession] Session has conversation_id:', !!session?.conversation_id);
      
      if (!session) {
        console.warn('[DeleteSession] Session not found in cache, assuming already deleted');
        return sessionId;
      }
      
      if (session.state === 'draft') {
        // Draft sessions are local only, no backend deletion needed
        console.log('[DeleteSession] Deleting draft (local only):', sessionId);
        return sessionId;  // Skip backend call
      }

      // Active sessions: delete from backend
      console.log('[DeleteSession] Deleting active session from backend:', sessionId);
      
      // Only delete from backend if it has a conversation_id
      if (!session.conversation_id) {
        console.log('[DeleteSession] No conversation_id, skipping backend deletion');
        return sessionId;
      }
      
      const authToken = searchParams.get('auth');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/v1/conversation/rm', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          conversation_ids: [session.conversation_id],  // FIX: Use conversation_id, not sessionId
        }),
      });

      const result = await response.json();
      if (result.code !== 0) {
        console.error('[DeleteSession] Backend deletion failed:', result.message);
        throw new Error(result.message || 'Failed to delete session');
      }
      
      console.log('[DeleteSession] Backend deletion successful');
      return sessionId;
    },
    onMutate: async (sessionId) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['freeChatSessions', userId, dialogId] });

      // Optimistic update
      const previous = queryClient.getQueryData(['freeChatSessions', userId, dialogId]);
      
      queryClient.setQueryData(
        ['freeChatSessions', userId, dialogId],
        (old: IFreeChatSession[] = []) => old.filter(s => s.id !== sessionId)
      );

      // Switch to first session if deleting current
      if (sessionId === currentSessionId) {
        const remaining = (previous as IFreeChatSession[] || []).filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          setCurrentSessionId('');
        }
      }

      return { previous };
    },
    onError: (err, sessionId, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          ['freeChatSessions', userId, dialogId],
          context.previous
        );
      }
      console.error('[DeleteSession] Error:', err);
    },
  });

  // Wrapper functions for easier usage
  const createSession = useCallback(
    (
      name?: string, 
      model_card_id?: number, 
      isDraft = false,
      conversationId?: string
    ): IFreeChatSession | undefined => {
      if (!model_card_id) {
        console.error('[createSession] model_card_id is required');
        return undefined;
      }
      
      // FIX: For draft sessions, handle entirely in wrapper (no mutation needed)
      if (isDraft) {
        const draftSession: IFreeChatSession = {
          id: uuid(),  // Local-only ID
          model_card_id,
          name: name || '新对话',
          messages: [],
          created_at: Date.now(),
          updated_at: Date.now(),
          state: 'draft',
        };
        
        console.log('[createSession] Creating draft (local only):', draftSession.id);
        
        // Immediately add to cache and switch to it
        queryClient.setQueryData(
          ['freeChatSessions', userId, dialogId],
          (old: IFreeChatSession[] = []) => [draftSession, ...old]
        );
        setCurrentSessionId(draftSession.id);
        
        return draftSession;
      }
      
      // For active sessions: trigger backend creation
      createSessionMutation.mutate({ 
        name, 
        model_card_id, 
        isDraft: false,
        conversationId
      });
      
      // Return undefined for active sessions (will be set by onSuccess)
      return undefined;
    },
    [createSessionMutation, queryClient, userId, dialogId]
  );

  const updateSession = useCallback(
    (sessionId: string, updates: Partial<IFreeChatSession>) => {
      updateSessionMutation.mutate({ sessionId, updates });
    },
    [updateSessionMutation]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      deleteSessionMutation.mutate(sessionId);
    },
    [deleteSessionMutation]
  );

  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  const clearAllSessions = useCallback(async () => {
    // Delete all sessions one by one
    const allSessions = queryClient.getQueryData(['freeChatSessions', userId, dialogId]) as IFreeChatSession[] || [];
    for (const session of allSessions) {
      // Use session.id (which equals conversation_id in our data model)
      deleteSessionMutation.mutate(session.id);
    }
    setCurrentSessionId('');
  }, [queryClient, userId, dialogId, deleteSessionMutation]);

  // Cleanup: Delete draft sessions when component unmounts or user leaves
  useEffect(() => {
    return () => {
      // On unmount, delete any draft sessions (cleanup)
      const allSessions = queryClient.getQueryData(['freeChatSessions', userId, dialogId]) as IFreeChatSession[] || [];
      const draftSessions = allSessions.filter(s => s.state === 'draft');
      
      if (draftSessions.length > 0) {
        console.log('[Cleanup] Deleting draft sessions:', draftSessions.map(s => s.id));
        draftSessions.forEach(draft => {
          // Remove from cache only (no backend call needed)
          queryClient.setQueryData(
            ['freeChatSessions', userId, dialogId],
            (old: IFreeChatSession[] = []) => old.filter(s => s.id !== draft.id)
          );
        });
      }
    };
  }, [queryClient, userId, dialogId]);

  return {
    sessions,
    currentSession,
    currentSessionId,
    isLoading,
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    clearAllSessions,
    refetchSessions,
  };
};
