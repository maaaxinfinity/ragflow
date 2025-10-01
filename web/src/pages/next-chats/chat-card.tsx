import { HomeCard } from '@/components/home-card';
import { MoreButton } from '@/components/more-button';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { IDialog } from '@/interfaces/database/chat';
import { ChatDropdown } from './chat-dropdown';
import { useRenameChat } from './hooks/use-rename-chat';
import { useCallback } from 'react';
import { useNavigate } from 'umi';
import { Routes } from '@/routes';

export type IProps = {
  data: IDialog;
} & Pick<ReturnType<typeof useRenameChat>, 'showChatRenameModal'>;

export function ChatCard({ data, showChatRenameModal }: IProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    // Navigate to next-chat/:id
    navigate(`${Routes.Chat}/${data.id}`);
  }, [data.id, navigate]);

  return (
    <HomeCard
      data={{
        name: data.name,
        description: data.description,
        avatar: data.icon,
        update_time: data.update_time,
      }}
      moreDropdown={
        <ChatDropdown chat={data} showChatRenameModal={showChatRenameModal}>
          <MoreButton></MoreButton>
        </ChatDropdown>
      }
      onClick={handleClick}
    />
  );
}
