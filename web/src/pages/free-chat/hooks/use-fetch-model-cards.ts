import { useQuery } from '@tanstack/react-query';
import { useGetUserInfo } from '@/hooks/user-setting-hooks';

export interface IModelCard {
  id: number;
  name: string;
  description: string;
  bot_id: string;
  temperature: number;
  top_p: number;
  prompt: string;
}

interface ModelCardsResponse {
  success: boolean;
  data: IModelCard[];
}

const MODEL_CARDS_API_URL = 'http://localhost:3001/api/model-cards';

/**
 * Fetch model cards from law-workspace API
 * Uses access_token from RAGFlow user info for authentication
 */
export const useFetchModelCards = () => {
  const { data: userInfo } = useGetUserInfo();

  return useQuery<IModelCard[]>({
    queryKey: ['modelCards', userInfo?.access_token],
    queryFn: async () => {
      if (!userInfo?.access_token) {
        throw new Error('No access token available');
      }

      const response = await fetch(MODEL_CARDS_API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userInfo.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch model cards: ${response.statusText}`);
      }

      const result: ModelCardsResponse = await response.json();

      if (!result.success) {
        throw new Error('Model cards API returned success=false');
      }

      return result.data;
    },
    enabled: !!userInfo?.access_token,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
