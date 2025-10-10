import { Routes } from '@/routes';
import api from '@/utils/api';
import request from '@/utils/request';
import { useLatest } from 'ahooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { history } from 'umi';
import { DynamicModelParams } from '../types';
import { logError, logInfo } from '../utils/error-handler';
import { IFreeChatSession } from './use-free-chat-session';

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
        console.log(
          '[Load] Success! Sessions count:',
          response.data.sessions?.length,
        );
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
      const errorMsg =
        e instanceof Error ? e.message : 'Failed to load settings';
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

  // ✅ FIX: Use ref to avoid dependency on settings (prevents infinite loop)
  const settingsRef = useLatest(settings);

  // Save current settings to API
  const saveToAPI = useCallback(async () => {
    const currentSettings = settingsRef.current;
    if (!userId || !currentSettings) {
      console.warn('[Save] Skipped - no userId or settings');
      return false;
    }

    try {
      setSaving(true);
      console.log('[Save] Saving settings for user:', userId);
      console.log(
        '[Save] Sessions count (before filter):',
        currentSettings.sessions?.length,
      );
      console.log('[Save] Dialog ID:', currentSettings.dialog_id);
      console.log(
        '[Save] Role prompt length:',
        currentSettings.role_prompt?.length || 0,
      );

      // Filter out draft sessions and strip messages from active sessions
      const activeSessions = (currentSettings.sessions || [])
        .filter((session) => session.state === 'active') // Only save active sessions
        .map((session) => ({
          id: session.id,
          conversation_id: session.conversation_id,
          model_card_id: session.model_card_id,
          name: session.name,
          created_at: session.created_at,
          updated_at: session.updated_at,
          state: session.state,
          is_favorited: session.is_favorited,
          params: session.params,
          // messages are intentionally excluded - they should be fetched from /v1/conversation/get
        }));

      console.log(
        '[Save] Active sessions count (after filter):',
        activeSessions.length,
      );

      const { data: response } = await request(api.saveFreeChatSettings, {
        method: 'POST',
        data: {
          ...currentSettings,
          sessions: activeSessions, // Only save active sessions without messages
        },
      });

      console.log('[Save] Response code:', response.code);
      console.log('[Save] Response message:', response.message);

      if (response.code === 0) {
        console.log(
          '[Save] Success! Returned sessions:',
          response.data.sessions?.length,
        );
        if (response.data.sessions?.length > 0) {
          console.log(
            '[Save] First session name:',
            response.data.sessions[0].name,
          );
        }
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
      const errorMsg =
        e instanceof Error ? e.message : 'Failed to save settings';
      logError(errorMsg, 'useFreeChatSettingsApi.saveToAPI');
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId, settingsRef]); // ✅ FIX: Removed 'settings' dependency to prevent infinite loop

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
      options?: { silent?: boolean; immediate?: boolean },
    ) => {
      const silent = options?.silent ?? false;
      const immediate = options?.immediate ?? false;
      console.log(
        '[UpdateField] Field:',
        field,
        'Value:',
        field === 'sessions' ? `${(value as any[]).length} sessions` : value,
        'Silent:',
        silent,
        'Immediate:',
        immediate,
      );

      // ✅ FIX: Use functional setState to avoid dependency on settings
      setSettings((prevSettings) => {
        if (!prevSettings) {
          console.warn('[UpdateField] No settings, skipping');
          return prevSettings;
        }

        // Update local state immediately
        return { ...prevSettings, [field]: value };
      });

      // Only set hasUnsavedChanges if not silent
      if (!silent) {
        setHasUnsavedChanges(true);
        console.log(
          '[UpdateField] Updated local state, hasUnsavedChanges=true',
        );
      } else {
        console.log(
          '[UpdateField] Updated local state (silent mode, no unsaved flag)',
        );
      }

      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Immediate save or schedule auto-save
      if (immediate) {
        console.log('[UpdateField] Immediate save requested');
        // Use setTimeout to ensure state update has been flushed
        setTimeout(() => {
          saveToAPI();
        }, 0);
      } else {
        // Debounce time: shorter for sessions (5s), longer for settings (30s)
        const debounceTime = field === 'sessions' ? 5000 : 30000;
        console.log(
          '[UpdateField] Scheduling auto-save in',
          debounceTime,
          'ms',
        );

        autoSaveTimerRef.current = setTimeout(() => {
          console.log('[UpdateField] Auto-save timer triggered');
          saveToAPI();
        }, debounceTime);
      }
    },
    [saveToAPI], // ✅ FIX: Removed 'settings' dependency to prevent infinite loop
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
