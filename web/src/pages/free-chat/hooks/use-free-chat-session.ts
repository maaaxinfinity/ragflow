import { MessageType } from '@/constants/chat';
import { Message } from '@/interfaces/database/chat';
import api from '@/utils/api';
import request from '@/utils/request';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { logError } from '../utils/error-handler';

export type SessionMessage = Message & {
  seq?: number;
  created_at?: number;
  reference?: any;
};

export interface IFreeChatSession {
  id: string;
  conversation_id?: string;
  name: string;
  messages: SessionMessage[];
  created_at: number;
  updated_at: number;
  message_count?: number;
  is_favorite: boolean;
}

interface UseFreeChatSessionProps {
  userId?: string;
}

const toMessageType = (role?: string): MessageType => {
  return role === MessageType.Assistant
    ? MessageType.Assistant
    : MessageType.User;
};

const normalizeMessages = (items: any[] = []): SessionMessage[] =>
  items.map((item) => ({
    id: item.id,
    role: toMessageType(item.role),
    content: item.content ?? '',
    reference: item.reference ?? undefined,
    created_at: item.created_at,
    seq: item.seq,
  }));

const normalizeSession = (session: any): IFreeChatSession => ({
  id: session.id,
  conversation_id: session.conversation_id,
  name: session.name,
  created_at: session.created_at,
  updated_at: session.updated_at,
  message_count: session.message_count,
  is_favorite: Boolean(session.is_favorite),
  messages: Array.isArray(session.messages)
    ? normalizeMessages(session.messages)
    : [],
});

export const useFreeChatSession = (props?: UseFreeChatSessionProps) => {
  const { userId } = props || {};
  const [sessions, setSessions] = useState<IFreeChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isDraftMode, setIsDraftMode] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const isUnmountedRef = useRef(false);

  const ensureCurrentSession = useCallback(
    (sessionList: IFreeChatSession[]) => {
      if (sessionList.length === 0) {
        setCurrentSessionId('');
        setIsDraftMode(true);
        return;
      }

      if (isDraftMode) {
        setCurrentSessionId('');
        return;
      }

      if (
        !currentSessionId ||
        !sessionList.find((s) => s.id === currentSessionId)
      ) {
        setCurrentSessionId(sessionList[0].id);
      }
    },
    [currentSessionId, isDraftMode],
  );

  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setCurrentSessionId('');
      return [] as IFreeChatSession[];
    }

    try {
      setLoading(true);
      const { data: response } = await request(api.listFreeChatSessions, {
        method: 'GET',
        params: { user_id: userId },
      });

      if (response.code === 0) {
        const normalized = (response.data ?? []).map(normalizeSession);
        const deduped = Array.from(
          new Map(normalized.map((s) => [s.id, s])).values(),
        );
        if (!isUnmountedRef.current) {
          setSessions(deduped);
          ensureCurrentSession(deduped);
        }
        return deduped;
      }

      logError(
        `Failed to fetch sessions (code ${response.code}): ${response.message || 'Unknown error'}`,
        'useFreeChatSession.fetchSessions',
      );
    } catch (error) {
      logError(
        error instanceof Error ? error.message : 'Failed to fetch sessions',
        'useFreeChatSession.fetchSessions',
      );
    } finally {
      if (!isUnmountedRef.current) {
        setLoading(false);
      }
    }

    return [] as IFreeChatSession[];
  }, [userId, ensureCurrentSession]);

  useEffect(() => {
    isUnmountedRef.current = false;
    fetchSessions();
    return () => {
      isUnmountedRef.current = true;
    };
  }, [fetchSessions]);

  const refreshSessions = useCallback(() => fetchSessions(), [fetchSessions]);

  const currentSession = sessions.find(
    (session) => session.id === currentSessionId,
  );

  const createLocalSession = useCallback(
    (name?: string): IFreeChatSession => ({
      id: uuid(),
      name: name || '来聊点啥',
      messages: [],
      created_at: Date.now(),
      updated_at: Date.now(),
      is_favorite: false,
    }),
    [sessions.length],
  );

  const createSession = useCallback(
    async (name?: string) => {
      const fallback = createLocalSession(name);
      setIsDraftMode(false);

      if (!userId) {
        setSessions((prev) => [fallback, ...prev]);
        setCurrentSessionId(fallback.id);
        return fallback;
      }

      const fallbackId = fallback.id;

      try {
        const { data: response } = await request(api.createFreeChatSession, {
          method: 'POST',
          data: {
            user_id: userId,
            name: fallback.name,
            conversation_id: fallback.conversation_id,
          },
        });

        if (response.code === 0 && response.data) {
          const normalized = normalizeSession(response.data);
          setSessions((prev) => {
            const filtered = prev.filter(
              (session) => session.id !== fallbackId,
            );
            return [normalized, ...filtered];
          });
          setCurrentSessionId(normalized.id);
          setIsDraftMode(false);
          return normalized;
        }

        logError(
          `Failed to create session (code ${response.code}): ${response.message || 'Unknown error'}`,
          'useFreeChatSession.createSession',
        );
      } catch (error) {
        logError(
          error instanceof Error ? error.message : 'Failed to create session',
          'useFreeChatSession.createSession',
        );
      }

      setSessions((prev) => {
        const filtered = prev.filter((session) => session.id !== fallbackId);
        return [fallback, ...filtered];
      });
      setCurrentSessionId(fallback.id);
      return fallback;
    },
    [createLocalSession, userId],
  );

  const updateSession = useCallback(
    (sessionId: string, updates: Partial<IFreeChatSession>) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? { ...session, ...updates, updated_at: Date.now() }
            : session,
        ),
      );

      if (!userId) {
        return;
      }

      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) {
        payload.name = updates.name;
      }
      if (updates.conversation_id !== undefined) {
        payload.conversation_id = updates.conversation_id;
      }

      if (Object.keys(payload).length === 0) {
        return;
      }

      request(api.updateFreeChatSession(sessionId), {
        method: 'PUT',
        data: payload,
      })
        .then(async ({ data: response }) => {
          if (response.code !== 0) {
            logError(
              `Failed to update session (code ${response.code}): ${response.message || 'Unknown error'}`,
              'useFreeChatSession.updateSession',
            );
            refreshSessions();
            return;
          }
          // Sync conversation title if name changed and conversation_id exists
          if (updates.name) {
            const session = sessions.find((s) => s.id === sessionId);
            const convId = updates.conversation_id || session?.conversation_id;
            if (convId) {
              try {
                await request(api.setConversation, {
                  method: 'POST',
                  data: {
                    conversation_id: convId,
                    is_new: false,
                    name: updates.name,
                  },
                });
              } catch (_) {}
            }
          }
        })
        .catch((error) => {
          logError(
            error instanceof Error ? error.message : 'Failed to update session',
            'useFreeChatSession.updateSession',
          );
          refreshSessions();
        });
    },
    [refreshSessions, sessions, userId],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      setSessions((prev) => {
        const nextSessions = prev.filter((session) => session.id !== sessionId);

        if (currentSessionId === sessionId) {
          setCurrentSessionId('');
          setIsDraftMode(nextSessions.length === 0);
        }

        return nextSessions;
      });

      if (!userId) {
        return;
      }

      try {
        const { data: response } = await request(
          api.deleteFreeChatSession(sessionId),
          {
            method: 'DELETE',
          },
        );

        if (response.code !== 0) {
          logError(
            `Failed to delete session (code ${response.code}): ${response.message || 'Unknown error'}`,
            'useFreeChatSession.deleteSession',
          );
          refreshSessions();
        } else {
          refreshSessions();
        }
      } catch (error) {
        logError(
          error instanceof Error ? error.message : 'Failed to delete session',
          'useFreeChatSession.deleteSession',
        );
        refreshSessions();
      }
    },
    [currentSessionId, refreshSessions, userId],
  );

  const toggleFavorite = useCallback(
    (sessionId: string) => {
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) {
        return;
      }

      const nextValue = !target.is_favorite;
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                is_favorite: nextValue,
                updated_at: Date.now(),
              }
            : session,
        ),
      );

      if (!userId) {
        return;
      }

      request(api.updateFreeChatSession(sessionId), {
        method: 'PUT',
        data: { is_favorite: nextValue },
      })
        .then(({ data: response }) => {
          if (response.code !== 0) {
            throw new Error(response.message || 'Failed to update favorite');
          }
          refreshSessions();
        })
        .catch((error) => {
          logError(
            error instanceof Error
              ? error.message
              : 'Failed to update favorite',
            'useFreeChatSession.toggleFavorite',
          );
          setSessions((prev) =>
            prev.map((session) =>
              session.id === sessionId
                ? { ...session, is_favorite: target.is_favorite }
                : session,
            ),
          );
        });
    },
    [refreshSessions, sessions, userId],
  );

  const switchSession = useCallback(
    (sessionId: string | null) => {
      if (!sessionId) {
        setCurrentSessionId('');
        setIsDraftMode(true);
        return;
      }

      if (sessions.find((session) => session.id === sessionId)) {
        setCurrentSessionId(sessionId);
        setIsDraftMode(false);
      }
    },
    [sessions],
  );

  const clearAllSessions = useCallback(async () => {
    const favorites = sessions.filter((session) => session.is_favorite);
    const removable = sessions.filter((session) => !session.is_favorite);
    const ids = removable.map((session) => session.id);

    if (ids.length === 0) {
      return;
    }

    setSessions(favorites);

    if (favorites.length > 0) {
      setCurrentSessionId(favorites[0].id);
      setIsDraftMode(false);
    } else {
      setCurrentSessionId('');
      setIsDraftMode(true);
    }

    if (!userId || ids.length === 0) {
      return;
    }

    try {
      await Promise.all(
        ids.map((sessionId) =>
          request(api.deleteFreeChatSession(sessionId), {
            method: 'DELETE',
          }).then(({ data: response }) => {
            if (response.code !== 0) {
              throw new Error(response.message || 'Failed to delete session');
            }
          }),
        ),
      );
    } catch (error) {
      logError(
        error instanceof Error ? error.message : 'Failed to clear sessions',
        'useFreeChatSession.clearAllSessions',
      );
    } finally {
      refreshSessions();
    }
  }, [refreshSessions, sessions, userId]);

  const loadMessages = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      return [] as SessionMessage[];
    }

    try {
      const { data: response } = await request(
        api.listFreeChatMessages(sessionId),
        {
          method: 'GET',
        },
      );

      if (response.code === 0) {
        const messages = normalizeMessages(response.data ?? []);
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, messages } : session,
          ),
        );
        return messages;
      }

      logError(
        `Failed to load messages (code ${response.code}): ${response.message || 'Unknown error'}`,
        'useFreeChatSession.loadMessages',
      );
    } catch (error) {
      logError(
        error instanceof Error ? error.message : 'Failed to load messages',
        'useFreeChatSession.loadMessages',
      );
    }

    return [] as SessionMessage[];
  }, []);

  const enterDraftMode = useCallback(() => {
    setIsDraftMode(true);
    setCurrentSessionId('');
  }, []);

  return {
    loading,
    sessions,
    currentSession,
    currentSessionId,
    isDraftMode,
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    clearAllSessions,
    refreshSessions,
    loadMessages,
    enterDraftMode,
    toggleFavorite,
  };
};
