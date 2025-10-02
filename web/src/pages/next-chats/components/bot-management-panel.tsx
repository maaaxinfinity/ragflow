import { Button } from '@/components/ui/button';
import { useFetchDialogList, useSetDialog, useRemoveDialog } from '@/hooks/use-chat-request';
import { Plus, Settings, Trash2, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RenameDialog } from '@/components/rename-dialog';
import { useSetModalState } from '@/hooks/common-hooks';
import { useFetchTenantInfo } from '@/hooks/use-user-setting-request';
import { IDialog } from '@/interfaces/database/chat';
import { BotConfigDialog } from './bot-config-dialog';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import { Routes } from '@/routes';
import { useNavigate } from 'umi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const { removeDialog, loading: deleteLoading } = useRemoveDialog();
  const tenantInfo = useFetchTenantInfo();
  const previousDialogCountRef = useRef(data.dialogs.length);
  const navigate = useNavigate();

  const [editingBot, setEditingBot] = useState<IDialog | null>(null);
  const [deletingBotId, setDeletingBotId] = useState<string | null>(null);

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
        await refetch();
      }
    },
    [InitialData, setDialog, hideChatRenameModal, refetch],
  );

  // Auto-select newly created bot
  useEffect(() => {
    const currentDialogCount = data.dialogs.length;
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

  const handleEditBot = useCallback(
    (e: React.MouseEvent, dialog: IDialog) => {
      e.stopPropagation();
      setEditingBot(dialog);
    },
    [],
  );

  const handleDeleteBot = useCallback(
    (e: React.MouseEvent, dialogId: string) => {
      e.stopPropagation();
      setDeletingBotId(dialogId);
    },
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (deletingBotId) {
      await removeDialog([deletingBotId]);
      setDeletingBotId(null);
      await refetch();
      // If deleted bot was selected, clear selection
      if (selectedBotId === deletingBotId) {
        onSelectBot('');
      }
    }
  }, [deletingBotId, removeDialog, refetch, selectedBotId, onSelectBot]);

  const handleConfigSuccess = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleEnterChat = useCallback(
    (e: React.MouseEvent, dialogId: string) => {
      e.stopPropagation();
      // Save dialog_id to localStorage for FreeChat to pick up
      localStorage.setItem('free_chat_dialog_id', dialogId);
      // Navigate to FreeChat
      navigate(Routes.FreeChat);
    },
    [navigate],
  );

  return (
    <section className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{t('chat.chatApps')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('chat.botManagementDescription')}
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
                relative p-4 rounded-lg cursor-pointer
                transition-all hover:shadow-md group
                ${
                  selectedBotId === dialog.id
                    ? 'border-2 border-primary bg-primary/5'
                    : 'border border-border hover:border-primary/50'
                }
              `}
            >
              {/* Action Buttons */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={(e) => handleEditBot(e, dialog)}
                >
                  <Settings className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => handleDeleteBot(e, dialog.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {/* Bot Info */}
              <div className="flex items-start gap-3 mb-3">
                <RAGFlowAvatar
                  className="size-10"
                  avatar={dialog.icon}
                  name={dialog.name}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{dialog.name}</h3>
                  {dialog.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {dialog.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Enter Chat Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => handleEnterChat(e, dialog.id)}
              >
                <MessageSquare className="size-4 mr-2" />
                {t('chat.enterChat')}
              </Button>
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

      {/* Edit Bot Config Dialog */}
      {editingBot && (
        <BotConfigDialog
          visible={!!editingBot}
          onClose={() => setEditingBot(null)}
          bot={editingBot}
          onSuccess={handleConfigSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingBotId}
        onOpenChange={() => setDeletingBotId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chat.deleteBot')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('chat.deleteBotConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteLoading}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
