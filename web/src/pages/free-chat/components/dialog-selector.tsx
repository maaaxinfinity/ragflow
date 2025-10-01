import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCallback, useEffect, useState } from 'react';
import { Select, Spin, message } from 'antd';
import { useTranslate } from '@/hooks/common-hooks';

interface Dialog {
  id: string;
  name: string;
  description?: string;
  llm_id?: string;
}

interface DialogSelectorProps {
  selectedDialogId: string;
  onDialogChange: (dialogId: string) => void;
}

export function DialogSelector({ selectedDialogId, onDialogChange }: DialogSelectorProps) {
  const { t } = useTranslate('chat');
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDialogs = useCallback(async () => {
    try {
      const response = await fetch('/api/dialog/list');
      const data = await response.json();

      if (data.code === 0) {
        setDialogs(data.data || []);
      } else {
        message.error('Failed to load dialogs');
      }
    } catch (error) {
      console.error('Failed to fetch dialogs:', error);
      message.error('Failed to load dialogs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDialogs();
  }, [fetchDialogs]);

  const handleChange = (value: string) => {
    localStorage.setItem('free_chat_dialog_id', value);
    onDialogChange(value);
    message.success('Dialog selected successfully');
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Select Dialog</Label>
        <div className="flex items-center justify-center p-4">
          <Spin />
        </div>
      </div>
    );
  }

  if (dialogs.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Select Dialog</Label>
        <div className="p-4 border rounded-md">
          <p className="text-sm text-muted-foreground mb-2">
            No dialogs available. Please create a dialog first.
          </p>
          <Button
            size="sm"
            onClick={() => window.location.href = '/next-chats'}
          >
            Go to Chat to Create Dialog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Select Dialog for Free Chat</Label>
      <Select
        style={{ width: '100%' }}
        placeholder="Select a dialog"
        value={selectedDialogId || undefined}
        onChange={handleChange}
        options={dialogs.map(dialog => ({
          label: dialog.name,
          value: dialog.id,
        }))}
      />
      <p className="text-xs text-muted-foreground">
        This dialog provides the base LLM configuration. You can still override parameters and knowledge bases dynamically.
      </p>
    </div>
  );
}
