/**
 * FreeChat Zustand Store
 * 使用 Zustand 管理会话状态，简化复杂的 useEffect 同步逻辑
 */

import { v4 as uuid } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { FreeChatSession, FreeChatStore } from '../types/free-chat.types';

/**
 * FreeChat Store
 *
 * 功能：
 * 1. 会话管理（创建、更新、删除、切换）
 * 2. 消息管理（添加、更新、删除）
 * 3. 自动持久化到 localStorage
 * 4. 不可变更新（通过 immer）
 */
export const useFreeChatStore = create<FreeChatStore>()(
  persist(
    immer((set, get) => ({
      // ==================== 状态 ====================
      sessions: [],
      currentSessionId: null,

      // ==================== 派生状态 ====================
      currentSession: () => {
        const { sessions, currentSessionId } = get();
        return sessions.find((s) => s.id === currentSessionId);
      },

      // ==================== 会话操作 ====================

      /**
       * 创建新会话
       * @param name 会话名称（可选）
       * @returns 新会话 ID
       */
      createSession: (name) => {
        let newId = '';
        set((state) => {
          const id = uuid();
          newId = id;

          const newSession: FreeChatSession = {
            id,
            name: name || `Chat ${state.sessions.length + 1}`,
            messages: [],
            created_at: Date.now(),
            updated_at: Date.now(),
          };

          // 添加到会话列表开头
          state.sessions.unshift(newSession);

          // 自动切换到新会话
          state.currentSessionId = id;
        });
        return newId;
      },

      /**
       * 更新会话
       * @param id 会话 ID
       * @param updates 更新内容
       */
      updateSession: (id, updates) => {
        set((state) => {
          const session = state.sessions.find((s) => s.id === id);
          if (session) {
            Object.assign(session, updates, { updated_at: Date.now() });
          }
        });
      },

      /**
       * 删除会话
       * @param id 会话 ID
       */
      deleteSession: (id) => {
        set((state) => {
          // 删除会话
          const index = state.sessions.findIndex((s) => s.id === id);
          if (index !== -1) {
            state.sessions.splice(index, 1);
          }

          // 如果删除的是当前会话，自动切换到第一个会话
          if (state.currentSessionId === id) {
            state.currentSessionId =
              state.sessions.length > 0 ? state.sessions[0].id : null;
          }
        });
      },

      /**
       * 切换会话
       * @param id 会话 ID
       */
      switchSession: (id) => {
        set((state) => {
          // 检查会话是否存在
          if (state.sessions.find((s) => s.id === id)) {
            state.currentSessionId = id;
          }
        });
      },

      /**
       * 清空所有会话
       */
      clearAllSessions: () => {
        set((state) => {
          state.sessions = [];
          state.currentSessionId = null;
        });
      },

      // ==================== 消息操作 ====================

      /**
       * 添加消息到当前会话
       * @param message 消息对象
       */
      addMessage: (message) => {
        set((state) => {
          const session = state.sessions.find(
            (s) => s.id === state.currentSessionId,
          );
          if (session) {
            session.messages.push(message);
            session.updated_at = Date.now();
          }
        });
      },

      /**
       * 更新消息
       * @param messageId 消息 ID
       * @param updates 更新内容
       */
      updateMessage: (messageId, updates) => {
        set((state) => {
          const session = state.sessions.find(
            (s) => s.id === state.currentSessionId,
          );
          if (session) {
            const message = session.messages.find((m) => m.id === messageId);
            if (message) {
              Object.assign(message, updates);
              session.updated_at = Date.now();
            }
          }
        });
      },

      /**
       * 删除消息
       * @param messageId 消息 ID
       */
      removeMessage: (messageId) => {
        set((state) => {
          const session = state.sessions.find(
            (s) => s.id === state.currentSessionId,
          );
          if (session) {
            const index = session.messages.findIndex((m) => m.id === messageId);
            if (index !== -1) {
              session.messages.splice(index, 1);
              session.updated_at = Date.now();
            }
          }
        });
      },

      // ==================== 批量操作 ====================

      /**
       * 设置所有会话（用于从服务器加载）
       * @param sessions 会话列表
       */
      setSessions: (sessions) => {
        set((state) => {
          state.sessions = sessions;

          // 如果当前没有选中会话且有会话列表，自动选中第一个
          if (!state.currentSessionId && sessions.length > 0) {
            state.currentSessionId = sessions[0].id;
          }
        });
      },
    })),
    {
      name: 'free-chat-storage', // localStorage key
      partialize: (state) => ({
        // 只持久化必要的数据
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    },
  ),
);

// ==================== 选择器（用于优化性能）====================

/**
 * 获取当前会话 ID
 */
export const useCurrentSessionId = () =>
  useFreeChatStore((state) => state.currentSessionId);

/**
 * 获取当前会话
 */
export const useCurrentSession = () =>
  useFreeChatStore((state) => state.currentSession());

/**
 * 获取所有会话
 */
export const useSessions = () => useFreeChatStore((state) => state.sessions);

/**
 * 获取当前会话的消息
 */
export const useCurrentMessages = () =>
  useFreeChatStore((state) => state.currentSession()?.messages || []);

/**
 * 获取会话操作方法
 */
export const useSessionActions = () =>
  useFreeChatStore((state) => ({
    createSession: state.createSession,
    updateSession: state.updateSession,
    deleteSession: state.deleteSession,
    switchSession: state.switchSession,
    clearAllSessions: state.clearAllSessions,
  }));

/**
 * 获取消息操作方法
 */
export const useMessageActions = () =>
  useFreeChatStore((state) => ({
    addMessage: state.addMessage,
    updateMessage: state.updateMessage,
    removeMessage: state.removeMessage,
  }));
