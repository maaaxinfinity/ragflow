import { useCallback, useEffect, useState } from 'react';
import { IFreeChatSession } from './use-free-chat-session';
import { DynamicModelParams } from '../types';
import api from '@/utils/api';
import request from '@/utils/request';
import { history } from 'umi';
import { logError, logInfo } from '../utils/error-handler';
import { Routes } from '@/routes';

interface FreeChatSettings {
  user_id: string;
  dialog_id: string;
  model_params: DynamicModelParams;
  kb_ids: string[];
  role_prompt: string;
  sessions: IFreeChatSession[];
}

const DEFAULT_SETTINGS: Omit<FreeChatSettings, 'user_id'> = {
  dialog_id: '',
  model_params: { temperature: 0.7, top_p: 0.9 },
  kb_ids: [],
  role_prompt: '',
  sessions: [],
};

/**
 * Hook to manage free chat user settings via API
 * This replaces localStorage with database storage
 */
export const useFreeChatSettingsApi = (userId: string) => {
  const [settings, setSettings] = useState<FreeChatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings from API
  const loadSettings = useCallback(async () => {
    if (!userId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await request(api.getFreeChatSettings, {
        method: 'GET',
        params: { user_id: userId },
      });

      if (response.code === 0) {
        setSettings(response.data);
        logInfo(`Loaded settings for user ${userId}`, 'useFreeChatSettingsApi');
      } else if (response.code === 102) {
        // Authentication error - user not in team
        logError('User not authorized for this team', 'useFreeChatSettingsApi');
        history.push(Routes.FreeChatUnauthorized);
      } else {
        // User has no settings yet, use defaults
        const defaultSettings: FreeChatSettings = {
          user_id: userId,
          ...DEFAULT_SETTINGS,
        };
        setSettings(defaultSettings);
      }
      setError(null);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to load settings';
      logError(errorMsg, 'useFreeChatSettingsApi.loadSettings');
      setError(errorMsg);
      // Use default settings on error
      setSettings({
        user_id: userId,
        ...DEFAULT_SETTINGS,
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Save settings to API
  const saveSettings = useCallback(
    async (updates: Partial<Omit<FreeChatSettings, 'user_id'>>) => {
      if (!userId || !settings) return false;

      try {
        const updatedSettings = { ...settings, ...updates };
        const response = await request(api.saveFreeChatSettings, {
          method: 'POST',
          data: updatedSettings,
        });

        if (response.code === 0) {
          setSettings(response.data);
          logInfo(
            `Saved settings for user ${userId}`,
            'useFreeChatSettingsApi.saveSettings',
          );
          return true;
        } else if (response.code === 102) {
          // Authentication error
          logError('User not authorized', 'useFreeChatSettingsApi.saveSettings');
          history.push(Routes.FreeChatUnauthorized);
          return false;
        } else {
          logError(
            response.message || 'Failed to save settings',
            'useFreeChatSettingsApi.saveSettings',
          );
          return false;
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Failed to save settings';
        logError(errorMsg, 'useFreeChatSettingsApi.saveSettings');
        return false;
      }
    },
    [userId, settings],
  );

  // Update specific field
  const updateField = useCallback(
    async <K extends keyof Omit<FreeChatSettings, 'user_id'>>(
      field: K,
      value: FreeChatSettings[K],
    ) => {
      return await saveSettings({ [field]: value });
    },
    [saveSettings],
  );

  // Load settings on mount or when userId changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    error,
    saveSettings,
    updateField,
    reload: loadSettings,
  };
};
