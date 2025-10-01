import { MoreButton } from '@/components/more-button';
import { RenameDialog } from '@/components/rename-dialog';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { useFetchDialogList } from '@/hooks/use-chat-request';
import { useTranslation } from 'react-i18next';
import { ChatDropdown } from '../next-chats/chat-dropdown';
import { useRenameChat } from '../next-chats/hooks/use-rename-chat';
import { ApplicationCard } from './application-card';
import { useCallback } from 'react';
import { useNavigate } from 'umi';
import { Routes } from '@/routes';

export function ChatList() {
  const { t } = useTranslation();
  const { data } = useFetchDialogList();
  const navigate = useNavigate();

  const {
    initialChatName,
    chatRenameVisible,
    showChatRenameModal,
    hideChatRenameModal,
    onChatRenameOk,
    chatRenameLoading,
  } = useRenameChat();

  const handleChatClick = useCallback((dialogId: string) => () => {
    // Save dialog_id to localStorage for free-chat
    localStorage.setItem('free_chat_dialog_id', dialogId);
    // Navigate to free-chat
    navigate(Routes.FreeChat);
  }, [navigate]);

  return (
    <>
      {data.dialogs.slice(0, 10).map((x) => (
        <ApplicationCard
          key={x.id}
          app={{
            avatar: x.icon,
            title: x.name,
            update_time: x.update_time,
          }}
          onClick={handleChatClick(x.id)}
          moreDropdown={
            <ChatDropdown chat={x} showChatRenameModal={showChatRenameModal}>
              <MoreButton></MoreButton>
            </ChatDropdown>
          }
        ></ApplicationCard>
      ))}
      {chatRenameVisible && (
        <RenameDialog
          hideModal={hideChatRenameModal}
          onOk={onChatRenameOk}
          initialName={initialChatName}
          loading={chatRenameLoading}
          title={initialChatName || t('chat.createChat')}
        ></RenameDialog>
      )}
    </>
  );
}
