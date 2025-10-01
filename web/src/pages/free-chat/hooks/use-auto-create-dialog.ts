import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { getAuthorization } from '@/utils/authorization-util';

const FREE_CHAT_DIALOG_NAME = 'Free Chat (Auto Created)';

export const useAutoCreateDialog = () => {
  const [dialogId, setDialogId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const createDefaultDialog = useCallback(async () => {
    try {
      // Check if dialog_id is already saved
      const savedDialogId = localStorage.getItem('free_chat_dialog_id');
      if (savedDialogId) {
        setDialogId(savedDialogId);
        setLoading(false);
        return;
      }

      // Get user's default tenant and LLM
      const tenantResponse = await fetch('/api/user/tenant', {
        headers: {
          Authorization: getAuthorization(),
        },
      });

      if (!tenantResponse.ok) {
        throw new Error('Failed to get tenant info');
      }

      const tenantData = await tenantResponse.json();

      if (tenantData.code !== 0) {
        throw new Error('No tenant found');
      }

      // Get available LLMs
      const llmResponse = await fetch('/api/llm', {
        headers: {
          Authorization: getAuthorization(),
        },
      });

      if (!llmResponse.ok) {
        throw new Error('Failed to get LLM list');
      }

      const llmData = await llmResponse.json();

      if (llmData.code !== 0 || !llmData.data || llmData.data.length === 0) {
        throw new Error('No LLM available');
      }

      // Use the first available LLM
      const defaultLlmId = llmData.data[0].model_name;

      // Create dialog
      const createResponse = await fetch('/api/dialog', {
        method: 'POST',
        headers: {
          Authorization: getAuthorization(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: FREE_CHAT_DIALOG_NAME,
          description: 'Automatically created for Free Chat feature',
          llm_id: defaultLlmId,
          kb_ids: [], // Empty by default, can be overridden dynamically
          prompt_config: {
            prologue: 'Hello! I am your AI assistant. How can I help you today?',
            quote: true,
          },
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create dialog');
      }

      const createData = await createResponse.json();

      if (createData.code !== 0) {
        throw new Error(createData.message || 'Failed to create dialog');
      }

      const newDialogId = createData.data.id;

      // Save to localStorage
      localStorage.setItem('free_chat_dialog_id', newDialogId);
      setDialogId(newDialogId);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to create default dialog:', err);
      setError(err.message || 'Unknown error');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    createDefaultDialog();
  }, [createDefaultDialog]);

  return {
    dialogId,
    loading,
    error,
    retry: createDefaultDialog,
  };
};
