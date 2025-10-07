import { useQuery } from '@tanstack/react-query';
import { getAuthorization } from '@/utils/authorization-util';

export interface IModelCard {
  id: number;
  name: string;
  description: string;
  bot_id: string;
  temperature: number;
  top_p: number;
  prompt: string;
}

/**
 * Fetch model cards from RAGFlow backend (proxied to law-workspace)
 * Backend endpoint: /v1/conversation/model_cards
 * Backend handles authentication and proxying to law-workspace API
 */
export const useFetchModelCards = () => {
  return useQuery<IModelCard[]>({
    queryKey: ['modelCards'],
    queryFn: async () => {
      const authorization = getAuthorization();

      if (!authorization) {
        throw new Error('No authorization token available. Please login first.');
      }

      const response = await fetch('/v1/conversation/model_cards', {
        method: 'GET',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch model cards: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(result.message || 'Failed to fetch model cards');
      }

      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
