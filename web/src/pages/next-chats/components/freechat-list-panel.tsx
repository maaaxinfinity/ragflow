import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, User } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';
import { Routes } from '@/routes';
import { useQuery } from '@tanstack/react-query';
import chatService from '@/services/next-chat-service';
import { IConversation } from '@/interfaces/database/chat';
import { useListTenantUser, useFetchUserInfo } from '@/hooks/user-setting-hooks';

interface FreeChatListPanelProps {
  dialogId: string;
}

export function FreeChatListPanel({ dialogId }: FreeChatListPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Fetch current user info
  const { data: currentUserInfo } = useFetchUserInfo();

  // Fetch tenant users for user info mapping
  const { data: tenantUsers = [] } = useListTenantUser();

  // Fetch conversation list for selected dialog
  const {
    data: conversations = [],
    isLoading,
    refetch,
  } = useQuery<IConversation[]>({
    queryKey: ['freechat-conversations', dialogId],
    enabled: Boolean(dialogId && dialogId.trim().length > 0),
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ queryKey }) => {
      // Use dialogId from queryKey to avoid closure issues
      const [, currentDialogId] = queryKey as [string, string];

      // Double check before making API call
      if (!currentDialogId || typeof currentDialogId !== 'string' || currentDialogId.trim() === '') {
        console.warn('listConversation called with invalid dialogId:', currentDialogId);
        return [];
      }

      const { data } = await chatService.listConversation(
        { params: { dialog_id: currentDialogId } },
        true,
      );
      if (data.code === 0) {
        return data.data;
      }
      return [];
    },
  });

  // Create user map for efficient lookup
  const userMap = useMemo(() => {
    const map = new Map();
    tenantUsers.forEach((user) => {
      map.set(user.user_id, user);
    });
    return map;
  }, [tenantUsers]);

  const handleCreateFreeChat = useCallback(() => {
    if (!dialogId) return;
    // Navigate to free-chat page with user_id and dialog_id
    const userId = currentUserInfo?.id || '';
    navigate(`${Routes.FreeChat}?user_id=${userId}&dialog_id=${dialogId}`);
  }, [dialogId, navigate, currentUserInfo]);

  const handleClickConversation = useCallback(
    (conversationId: string) => {
      // Navigate to free-chat page with current user's ID and conversation_id
      // IMPORTANT: Always use current logged-in user's ID, not the conversation creator's ID
      const userId = currentUserInfo?.id || '';
      navigate(`${Routes.FreeChat}?user_id=${userId}&conversation_id=${conversationId}`);
    },
    [navigate, currentUserInfo],
  );

  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) =>
        new Date(b.update_time).getTime() - new Date(a.update_time).getTime(),
    );
  }, [conversations]);

  return (
    <section className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{t('chat.freechatSessions')}</h2>
          <p className="text-sm text-muted-foreground">
            {dialogId
              ? t('chat.freechatSessionsDescription')
              : t('chat.selectBotPrompt')}
          </p>
        </div>
        {dialogId && (
          <Button onClick={handleCreateFreeChat}>
            <Plus className="size-4 mr-2" />
            {t('chat.createChat')}
          </Button>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-auto">
        {!dialogId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="size-12 mx-auto mb-4 opacity-50" />
              <p>{t('chat.selectBotToViewSessions')}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="size-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">{t('chat.noSessionsYet')}</p>
              <Button onClick={handleCreateFreeChat} variant="outline">
                <Plus className="size-4 mr-2" />
                {t('chat.createFirstChat')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedConversations.map((conversation) => {
              const user = conversation.user_id
                ? userMap.get(conversation.user_id)
                : null;
              const userName = user?.nickname || user?.email || t('chat.unknownUser');

              return (
                <div
                  key={conversation.id}
                  onClick={() => handleClickConversation(conversation.id)}
                  className="p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {conversation.name || t('chat.untitledChat')}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="size-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground truncate">
                          {userName}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('chat.updated')}:{' '}
                        {new Date(conversation.update_time).toLocaleString()}
                      </p>
                    </div>
                    <MessageSquare className="size-5 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
