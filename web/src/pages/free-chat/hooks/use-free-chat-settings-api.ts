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
      console.log('[Load] Fetching settings for user:', userId);
      const { data: response } = await request(api.getFreeChatSettings, {
        method: 'GET',
        params: { user_id: userId },
      });

      console.log('[Load] Response code:', response.code);
      console.log('[Load] Response data:', response.data);

      if (response.code === 0) {
        console.log('[Load] Success! Sessions count:', response.data.sessions?.length);
        setSettings(response.data);
        logInfo(`Loaded settings for user ${userId}`, 'useFreeChatSettingsApi');
      } else if (response.code === 102) {
        // Authentication error - user not in team
        console.error('[Load] Authentication error');
        logError('User not authorized for this team', 'useFreeChatSettingsApi');
        history.push(Routes.FreeChatUnauthorized);
      } else {
        // User has no settings yet, use defaults
        console.log('[Load] No settings found, using defaults');
        const defaultSettings: FreeChatSettings = {
          user_id: userId,
          ...DEFAULT_SETTINGS,
        };
        setSettings(defaultSettings);
      }
      setError(null);
    } catch (e) {
      console.error('[Load] Exception:', e);
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
    if (!userId || !settings) {
      console.warn('[Save] Skipped - no userId or settings');
      return false;
    }

    try {
      setSaving(true);
      console.log('[Save] Saving settings for user:', userId);
      console.log('[Save] Sessions count:', settings.sessions?.length);
      console.log('[Save] Dialog ID:', settings.dialog_id);
      console.log('[Save] Role prompt length:', settings.role_prompt?.length || 0);

      const { data: response } = await request(api.saveFreeChatSettings, {
        method: 'POST',
        data: settings,
      });

      console.log('[Save] Response code:', response.code);
      console.log('[Save] Response message:', response.message);

      if (response.code === 0) {
        console.log('[Save] Success! Returned sessions:', response.data.sessions?.length);
        setSettings(response.data);
        setHasUnsavedChanges(false);
        logInfo(
          `Saved settings for user ${userId}`,
          'useFreeChatSettingsApi.saveToAPI',
        );
        return true;
      } else if (response.code === 102) {
        // Authentication error
        console.error('[Save] Authentication error');
        logError('User not authorized', 'useFreeChatSettingsApi.saveToAPI');
        history.push(Routes.FreeChatUnauthorized);
        return false;
      } else {
        console.error('[Save] Failed with code:', response.code);
        logError(
          `Failed to save settings (code ${response.code}): ${response.message || 'Unknown error'}`,
          'useFreeChatSettingsApi.saveToAPI',
        );
        return false;
      }
    } catch (e) {
      console.error('[Save] Exception:', e);
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
      options?: { silent?: boolean }
    ) => {
      const silent = options?.silent ?? false;
      console.log('[UpdateField] Field:', field, 'Value:', field === 'sessions' ? `${(value as any[]).length} sessions` : value, 'Silent:', silent);

      if (!settings) {
        console.warn('[UpdateField] No settings, skipping');
        return;
      }

      // Update local state immediately
      const updatedSettings = { ...settings, [field]: value };
      setSettings(updatedSettings);

      // Only set hasUnsavedChanges if not silent
      if (!silent) {
        setHasUnsavedChanges(true);
        console.log('[UpdateField] Updated local state, hasUnsavedChanges=true');
      } else {
        console.log('[UpdateField] Updated local state (silent mode, no unsaved flag)');
      }

      // Debounce time: shorter for sessions (5s), longer for settings (30s)
      const debounceTime = field === 'sessions' ? 5000 : 30000;
      console.log('[UpdateField] Scheduling auto-save in', debounceTime, 'ms');

      // Schedule auto-save
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        console.log('[UpdateField] Auto-save timer triggered');
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
