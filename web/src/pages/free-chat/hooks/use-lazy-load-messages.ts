/**
 * Lazy Load Messages Hook
 * 
 * ✅ Principle 2: Lazy Loading for Performance
 * - Messages are loaded on-demand when switching to a session
 * - Not loaded during initial settings fetch
 * - Cached for 5 minutes to avoid repeated requests
 * 
 * Usage:
 *   const { data, isLoading } = useLazyLoadMessages(conversation_id);
 *   // data.messages contains the full message array
 */

import { useQuery } from '@tanstack/react-query';
import request from '@/utils/request';
import api from '@/utils/api';
import { Message } from '@/interfaces/database/chat';

interface ConversationMessagesResponse {
  conversation_id: string;
  messages: Message[];
  message_count: number;
}

interface UseLazyLoadMessagesOptions {
  enabled?: boolean;
}

/**
 * Lazy load messages for a conversation
 * 
 * @param conversationId Conversation ID (if undefined/null, query is disabled)
 * @param options Query options
 * @returns React Query result with messages data
 */
export const useLazyLoadMessages = (
  conversationId?: string,
  options?: UseLazyLoadMessagesOptions
) => {
  return useQuery<ConversationMessagesResponse>({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) {
        throw new Error('conversation_id is required for lazy loading messages');
      }

      const { data } = await request(api.getConversationMessages, {
        method: 'GET',
        params: { conversation_id: conversationId },
      });

      if (data.code !== 0) {
        throw new Error(data.message || 'Failed to load messages');
      }

      return data.data;
    },
    // Only fetch when conversation_id exists and options.enabled is not false
    enabled: !!conversationId && (options?.enabled !== false),
    // Don't cache data - always fetch fresh when switching sessions
    // This ensures we see the latest messages including those from other devices
    staleTime: 0,
    // Keep in cache for 5 minutes after unmount
    gcTime: 5 * 60 * 1000,
    // Retry once on failure
    retry: 1,
  });
};
