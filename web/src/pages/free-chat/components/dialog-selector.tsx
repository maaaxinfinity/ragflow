import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchDialogList } from '@/hooks/use-chat-request';
import { Select, Spin } from 'antd';

interface DialogSelectorProps {
  selectedDialogId: string;
  onDialogChange: (dialogId: string) => void;
  // Optional mock data for test mode (bypass network)
  mockDialogs?: Array<{ id: string; name: string }>;
}

export function DialogSelector({
  selectedDialogId,
  onDialogChange,
  mockDialogs,
}: DialogSelectorProps) {
  const { t } = useTranslate('chat');
  // Disable fetching when mock is provided
  const { data, loading } = useFetchDialogList(!mockDialogs);

  const handleChange = (value: string) => {
    localStorage.setItem('free_chat_dialog_id', value);
    onDialogChange(value);
  };

  if (!mockDialogs && loading) {
    return (
      <div className="space-y-2">
        <Label>{t('selectDialog')}</Label>
        <div className="flex items-center justify-center p-4">
          <Spin />
        </div>
      </div>
    );
  }

  const dialogs = mockDialogs
    ? mockDialogs.map((d) => ({ id: d.id, name: d.name }))
    : data?.dialogs ?? [];

  if (dialogs.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{t('selectDialog')}</Label>
        <div className="p-4 border rounded-md">
          <p className="text-sm text-muted-foreground mb-2">
            {t('noDialogsAvailable')}
          </p>
          <Button
            size="sm"
            onClick={() => (window.location.href = '/next-chats')}
          >
            {t('goToCreateDialog')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{t('selectDialogForFreeChat')}</Label>
      <Select
        style={{ width: '100%' }}
        placeholder={t('selectDialog')}
        value={selectedDialogId || undefined}
        onChange={handleChange}
        options={dialogs.map((dialog) => ({
          label: dialog.name,
          value: dialog.id,
        }))}
      />
      <p className="text-xs text-muted-foreground">
        {t('dialogProvideBaseConfig')}
      </p>
    </div>
  );
}
