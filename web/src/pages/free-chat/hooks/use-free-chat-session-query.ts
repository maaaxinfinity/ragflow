import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuid } from 'uuid';
import { Message } from '@/interfaces/database/chat';
import api from '@/utils/api';
import { useSearchParams } from 'umi';

export interface IFreeChatSession {
  id: string;
  conversation_id?: string;
  model_card_id?: number;
  name: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
  state?: 'draft' | 'active' | 'archived';
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
    refetchOnWindowFocus: true, // Auto-refresh on window focus
    refetchOnReconnect: true,   // Auto-refresh on network reconnect
    // Optional: background polling (disabled by default to save resources)
    // refetchInterval: 30000,  // Poll every 30 seconds
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
      if (!dialogId || !model_card_id) {
        throw new Error('dialog_id and model_card_id are required');
      }

      const authToken = searchParams.get('auth');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Create conversation on backend immediately
      const response = await fetch('/v1/conversation/set', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          conversation_id: uuid(),  // Generate ID on frontend
          dialog_id: dialogId,
          user_id: userId,
          name: name || (isDraft ? 'Draft - 请选择助手' : '新对话'),
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
        state: isDraft ? 'draft' : 'active',
      } as IFreeChatSession;
    },
    onSuccess: (newSession) => {
      // Optimistic update - add new session to cache immediately
      queryClient.setQueryData(
        ['freeChatSessions', userId, dialogId],
        (old: IFreeChatSession[] = []) => [newSession, ...old]
      );
      
      // Switch to new session
      setCurrentSessionId(newSession.id);
      
      // Background refresh to sync with server
      setTimeout(() => refetchSessions(), 500);
      
      console.log('[CreateSession] Success:', newSession.id);
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

      // Optimistic update
      const previous = queryClient.getQueryData(['freeChatSessions', userId, dialogId]);
      
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

      return { previous };
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
    onSettled: () => {
      // Background refresh
      setTimeout(() => refetchSessions(), 1000);
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
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
    (name?: string, model_card_id?: number, isDraft = false) => {
      createSessionMutation.mutate({ name, model_card_id, isDraft });
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
      if (session.conversation_id) {
        deleteSessionMutation.mutate(session.conversation_id);
      }
    }
    setCurrentSessionId('');
  }, [queryClient, userId, dialogId, deleteSessionMutation]);

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
