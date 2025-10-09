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
    refetch: refetchSessions 
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
        return result.data || [];
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

  // Get current session
  const currentSession = sessions.find((s: IFreeChatSession) => s.id === currentSessionId);

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async ({ 
      name, 
      model_card_id, 
      isDraft = false 
    }: { 
      name?: string; 
      model_card_id?: number; 
      isDraft?: boolean;
    }) => {
      if (!model_card_id) {
        throw new Error('model_card_id is required');
      }

      // FIX: Draft sessions are NOT created on backend immediately
      // They are only local until user sends first message
      if (isDraft) {
        const draftSession: IFreeChatSession = {
          id: uuid(),  // Local ID only
          model_card_id,
          name: name || '新对话',
          messages: [],
          created_at: Date.now(),
          updated_at: Date.now(),
          state: 'draft',
          // No conversation_id - will be created when user sends first message
        };
        console.log('[CreateSession] Created draft (local only):', draftSession.id);
        return draftSession;
      }

      // Non-draft: create on backend immediately
      if (!dialogId) {
        throw new Error('dialog_id is required for non-draft session');
      }

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
          conversation_id: uuid(),
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
        state: 'active',
      } as IFreeChatSession;
    },
    onSuccess: (newSession) => {
      console.log('[CreateSession] Session created:', newSession);
      
      // Optimistic update - add new session to cache immediately
      queryClient.setQueryData(
        ['freeChatSessions', userId, dialogId],
        (old: IFreeChatSession[] = []) => {
          console.log('[CreateSession] Updating cache, old sessions:', old.length);
          return [newSession, ...old];
        }
      );
      
      // Switch to new session
      setCurrentSessionId(newSession.id);
      console.log('[CreateSession] Switched to session:', newSession.id);
      
      // FIX: Only refresh from backend for active sessions (not drafts)
      // Draft sessions are local-only and will be lost if we refetch
      if (newSession.state !== 'draft') {
        setTimeout(() => {
          console.log('[CreateSession] Triggering background refresh for active session');
          refetchSessions();
        }, 500);
      } else {
        console.log('[CreateSession] Skipping refetch for draft session (local-only)');
      }
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
      // FIX: Check if session is draft (local only)
      const allSessions = queryClient.getQueryData(['freeChatSessions', userId, dialogId]) as IFreeChatSession[] || [];
      const session = allSessions.find(s => s.id === sessionId);
      
      if (session?.state === 'draft') {
        // Draft sessions are local only, no backend deletion needed
        console.log('[DeleteSession] Deleting draft (local only):', sessionId);
        return sessionId;  // Skip backend call
      }

      // Active sessions: delete from backend
      console.log('[DeleteSession] Deleting active session from backend:', sessionId);
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
          conversation_ids: [sessionId],
        }),
      });

      const result = await response.json();
      if (result.code !== 0) {
        throw new Error(result.message || 'Failed to delete session');
      }

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
    (name?: string, model_card_id?: number, isDraft = false): IFreeChatSession | undefined => {
      // Trigger mutation
      createSessionMutation.mutate({ name, model_card_id, isDraft });
      
      // Return a temporary session object immediately for optimistic UI
      // The real session will be updated via onSuccess callback
      if (model_card_id) {
        const tempSession: IFreeChatSession = {
          id: uuid(),  // Temporary ID, will be replaced by backend ID
          model_card_id,
          name: name || (isDraft ? 'Draft - 请选择助手' : '新对话'),
          messages: [],
          created_at: Date.now(),
          updated_at: Date.now(),
          state: isDraft ? 'draft' : 'active',
        };
        return tempSession;
      }
      return undefined;
    },
    [createSessionMutation]
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
