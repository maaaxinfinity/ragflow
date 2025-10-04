import { useCallback, useEffect, useState, useRef } from 'react';
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
 * Optimized save strategy:
 * - Sessions: debounced 5s
 * - Other settings: auto-save after 30s
 * - Manual save: immediate
 */
export const useFreeChatSettingsApi = (userId: string) => {
  const [settings, setSettings] = useState<FreeChatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Save current settings to API
  const saveToAPI = useCallback(async () => {
    console.log('[useFreeChatSettingsApi] saveToAPI called');
    console.log('[useFreeChatSettingsApi] userId:', userId);
    console.log('[useFreeChatSettingsApi] settings:', {
      ...settings,
      sessions: settings?.sessions?.length + ' sessions',
      role_prompt: settings?.role_prompt?.substring(0, 50) + '...',
    });

    if (!userId || !settings) {
      console.warn('[useFreeChatSettingsApi] saveToAPI: userId or settings is null');
      return false;
    }

    try {
      setSaving(true);
      console.log('[useFreeChatSettingsApi] Sending POST request with', settings.sessions?.length, 'sessions');
      const response = await request(api.saveFreeChatSettings, {
        method: 'POST',
        data: settings,
      });

      if (response.code === 0) {
        setSettings(response.data);
        setHasUnsavedChanges(false);
        logInfo(
          `Saved settings for user ${userId}`,
          'useFreeChatSettingsApi.saveToAPI',
        );
        return true;
      } else if (response.code === 102) {
        // Authentication error
        logError('User not authorized', 'useFreeChatSettingsApi.saveToAPI');
        history.push(Routes.FreeChatUnauthorized);
        return false;
      } else {
        logError(
          response.message || 'Failed to save settings',
          'useFreeChatSettingsApi.saveToAPI',
        );
        return false;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to save settings';
      logError(errorMsg, 'useFreeChatSettingsApi.saveToAPI');
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId, settings]);

  // Manual save - saves immediately
  const manualSave = useCallback(async () => {
    // Clear auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    return await saveToAPI();
  }, [saveToAPI]);

  // Update field locally and schedule auto-save
  const updateField = useCallback(
    <K extends keyof Omit<FreeChatSettings, 'user_id'>>(
      field: K,
      value: FreeChatSettings[K],
    ) => {
      console.log('[useFreeChatSettingsApi] updateField called:', field,
        field === 'sessions' ? `${(value as any[]).length} sessions` : value);

      if (!settings) {
        console.warn('[useFreeChatSettingsApi] updateField: settings is null, skipping');
        return;
      }

      // Update local state immediately
      const updatedSettings = { ...settings, [field]: value };
      console.log('[useFreeChatSettingsApi] Updated settings:', {
        ...updatedSettings,
        sessions: updatedSettings.sessions?.length + ' sessions',
      });
      setSettings(updatedSettings);
      setHasUnsavedChanges(true);

      // Debounce time: shorter for sessions (5s), longer for settings (30s)
      const debounceTime = field === 'sessions' ? 5000 : 30000;

      // Schedule auto-save
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        console.log('[useFreeChatSettingsApi] Auto-save triggered for field:', field);
        saveToAPI();
      }, debounceTime);
    },
    [settings, saveToAPI],
  );

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Load settings on mount or when userId changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    saving,
    error,
    hasUnsavedChanges,
    updateField,
    manualSave,
    reload: loadSettings,
  };
};
