import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFetchDialogList } from '@/hooks/use-chat-request';
import { Select, Spin } from 'antd';
import { useTranslate } from '@/hooks/common-hooks';

interface DialogSelectorProps {
  selectedDialogId: string;
  onDialogChange: (dialogId: string) => void;
}

export function DialogSelector({
  selectedDialogId,
  onDialogChange,
}: DialogSelectorProps) {
  const { t } = useTranslate('chat');
  const { data, loading } = useFetchDialogList();

  const handleChange = (value: string) => {
    localStorage.setItem('free_chat_dialog_id', value);
    onDialogChange(value);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{t('selectDialog')}</Label>
        <div className="flex items-center justify-center p-4">
          <Spin />
        </div>
      </div>
    );
  }

  if (data.dialogs.length === 0) {
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
        options={data.dialogs.map((dialog) => ({
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
