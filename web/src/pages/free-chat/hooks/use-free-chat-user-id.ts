import { useSearchParams } from 'umi';
import { useMemo } from 'react';

/**
 * Hook to get user_id from URL parameters for free chat
 * Supports embedding via iframe with user_id parameter
 * Example: /free-chat?conversation_id=xxx&user_id=external_user_123
 */
export const useFreeChatUserId = () => {
  const [searchParams] = useSearchParams();

  const userId = useMemo(() => {
    return searchParams.get('user_id') || '';
  }, [searchParams]);

  return userId;
};
