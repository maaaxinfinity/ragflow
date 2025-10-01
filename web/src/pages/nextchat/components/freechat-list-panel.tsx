import { Button } from '@/components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';
import { Routes } from '@/routes';
import { useQuery } from '@tanstack/react-query';
import chatService from '@/services/next-chat-service';
import { IConversation } from '@/interfaces/database/chat';

interface FreeChatListPanelProps {
  dialogId: string;
}

export function FreeChatListPanel({ dialogId }: FreeChatListPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Fetch conversation list for selected dialog
  const { data: conversations = [], isLoading, refetch } = useQuery<IConversation[]>({
    queryKey: ['freechat-conversations', dialogId],
    enabled: !!dialogId,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!dialogId) return [];
      const { data } = await chatService.listConversation({
        params: { dialog_id: dialogId },
      });
      if (data.code === 0) {
        return data.data;
      }
      return [];
    },
  });

  const handleCreateFreeChat = useCallback(() => {
    if (!dialogId) return;
    // Navigate to next-chat/:id to create new conversation
    navigate(`${Routes.Chat}/${dialogId}`);
  }, [dialogId, navigate]);

  const handleClickConversation = useCallback(
    (conversationId: string) => {
      if (!dialogId) return;
      // Navigate to next-chat/:id with conversationId query
      navigate(
        `${Routes.Chat}/${dialogId}?conversation_id=${conversationId}`,
      );
    },
    [dialogId, navigate],
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
          <h2 className="text-xl font-bold">FreeChat Sessions</h2>
          <p className="text-sm text-muted-foreground">
            {dialogId
              ? 'Chat sessions for the selected bot'
              : 'Select a bot to view sessions'}
          </p>
        </div>
        {dialogId && (
          <Button onClick={handleCreateFreeChat}>
            <Plus className="size-4 mr-2" />
            New Chat
          </Button>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-auto">
        {!dialogId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="size-12 mx-auto mb-4 opacity-50" />
              <p>Select a Bot above to view FreeChat sessions</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="size-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No chat sessions yet</p>
              <Button onClick={handleCreateFreeChat} variant="outline">
                <Plus className="size-4 mr-2" />
                Create First Chat
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleClickConversation(conversation.id)}
                className="p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {conversation.name || 'Untitled Chat'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Updated:{' '}
                      {new Date(conversation.update_time).toLocaleString()}
                    </p>
                  </div>
                  <MessageSquare className="size-5 text-muted-foreground flex-shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
