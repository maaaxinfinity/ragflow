import { Button } from '@/components/ui/button';
import { useFetchDialogList, useSetDialog } from '@/hooks/use-chat-request';
import { Plus, Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RenameDialog } from '@/components/rename-dialog';
import { useSetModalState } from '@/hooks/common-hooks';
import { useFetchTenantInfo } from '@/hooks/use-user-setting-request';
import { IDialog } from '@/interfaces/database/chat';

interface BotManagementPanelProps {
  onSelectBot: (dialogId: string) => void;
  selectedBotId: string;
}

export function BotManagementPanel({
  onSelectBot,
  selectedBotId,
}: BotManagementPanelProps) {
  const { data, refetch } = useFetchDialogList();
  const { t } = useTranslation();
  const { setDialog, loading: chatRenameLoading } = useSetDialog();
  const tenantInfo = useFetchTenantInfo();
  const previousDialogCountRef = useRef(data.dialogs.length);

  const {
    visible: chatRenameVisible,
    hideModal: hideChatRenameModal,
    showModal: showChatRenameModal,
  } = useSetModalState();

  const InitialData = useMemo(
    () => ({
      name: '',
      icon: '',
      language: 'English',
      description: '',
      prompt_config: {
        empty_response: '',
        prologue: t('chat.setAnOpenerInitial'),
        quote: true,
        keyword: false,
        tts: false,
        system: t('chat.systemInitialValue'),
        refine_multiturn: false,
        use_kg: false,
        reasoning: false,
        parameters: [{ key: 'knowledge', optional: false }],
      },
      llm_id: tenantInfo.data.llm_id,
      llm_setting: {},
      similarity_threshold: 0.2,
      vector_similarity_weight: 0.3,
      top_n: 8,
    }),
    [t, tenantInfo.data.llm_id],
  );

  const onChatRenameOk = useCallback(
    async (name: string) => {
      const nextChat = {
        ...InitialData,
        name,
      };
      const ret = await setDialog(nextChat);

      if (ret === 0) {
        hideChatRenameModal();
        // Refetch to get the new bot list
        await refetch();
      }
    },
    [InitialData, setDialog, hideChatRenameModal, refetch],
  );

  // Auto-select newly created bot
  useEffect(() => {
    const currentDialogCount = data.dialogs.length;
    // If dialog count increased, select the newest one
    if (currentDialogCount > previousDialogCountRef.current) {
      const sortedDialogs = [...data.dialogs].sort(
        (a, b) =>
          new Date(b.create_time || b.update_time).getTime() -
          new Date(a.create_time || a.update_time).getTime(),
      );
      if (sortedDialogs[0]) {
        onSelectBot(sortedDialogs[0].id);
      }
    }
    previousDialogCountRef.current = currentDialogCount;
  }, [data.dialogs, onSelectBot]);

  const handleShowCreateModal = useCallback(() => {
    showChatRenameModal();
  }, [showChatRenameModal]);

  const handleBotClick = useCallback(
    (dialog: IDialog) => {
      onSelectBot(dialog.id);
    },
    [onSelectBot],
  );

  return (
    <section className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{t('chat.chatApps')}</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage your chat bots
          </p>
        </div>
        <Button onClick={handleShowCreateModal}>
          <Plus className="size-4 mr-2" />
          {t('chat.createChat')}
        </Button>
      </div>

      {/* Bot List */}
      <div className="flex-1 overflow-auto">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.dialogs.map((dialog) => (
            <div
              key={dialog.id}
              onClick={() => handleBotClick(dialog)}
              className={`
                relative p-4 border rounded-lg cursor-pointer
                transition-all hover:shadow-md
                ${
                  selectedBotId === dialog.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }
              `}
            >
              {/* Selected Indicator */}
              {selectedBotId === dialog.id && (
                <div className="absolute top-2 right-2">
                  <Check className="size-5 text-primary" />
                </div>
              )}

              {/* Bot Info */}
              <div className="flex items-start gap-3">
                {dialog.icon && (
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{dialog.icon}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{dialog.name}</h3>
                  {dialog.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {dialog.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Dialog Modal */}
      {chatRenameVisible && (
        <RenameDialog
          hideModal={hideChatRenameModal}
          onOk={onChatRenameOk}
          initialName={''}
          loading={chatRenameLoading}
          title={t('chat.createChat')}
        />
      )}
    </section>
  );
}
