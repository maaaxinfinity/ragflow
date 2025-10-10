/**
 * React Query Hooks for FreeChat Settings
 * 使用 React Query 优化状态管理
 */

import { Routes } from '@/routes';
import api from '@/utils/api';
import request from '@/utils/request';
import {
  UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { history } from 'umi';
import {
  ApiResponse,
  DEFAULT_SETTINGS,
  FreeChatSettings,
  UpdateFieldOptions,
} from '../types/free-chat.types';
import { logError, logInfo } from '../utils/error-handler';

// ==================== Query Keys ====================

export const freeChatKeys = {
  all: ['freeChat'] as const,
  settings: (userId: string) =>
    [...freeChatKeys.all, 'settings', userId] as const,
  dialogs: () => [...freeChatKeys.all, 'dialogs'] as const,
  adminToken: () => [...freeChatKeys.all, 'adminToken'] as const,
};

// ==================== Custom Errors ====================

class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// ==================== Query Hooks ====================

/**
 * 获取用户设置
 */
export function useFreeChatSettings(
  userId: string,
): UseQueryResult<FreeChatSettings, Error> {
  return useQuery<FreeChatSettings, Error>({
    queryKey: freeChatKeys.settings(userId),
    queryFn: async () => {
      const { data } = await request<ApiResponse<FreeChatSettings>>(
        api.getFreeChatSettings,
        {
          method: 'GET',
          params: { user_id: userId },
        },
      );

      if (data.code === 102) {
        throw new UnauthorizedError('User not authorized for this team');
      }

      if (data.code === 0) {
        return data.data;
      }

      // 用户无设置，返回默认值
      return {
        user_id: userId,
        ...DEFAULT_SETTINGS,
      } as FreeChatSettings;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据新鲜
    gcTime: 10 * 60 * 1000, // 10分钟后垃圾回收
    retry: (failureCount, error) => {
      // 认证错误不重试
      if (error instanceof UnauthorizedError) {
        history.push(Routes.FreeChatUnauthorized);
        return false;
      }
      return failureCount < 3;
    },
    meta: {
      onError: (error: Error) => {
        logError(error.message, 'useFreeChatSettings');
      },
    },
  });
}

/**
 * 保存用户设置 Mutation
 */
export function useSaveFreeChatSettings(userId: string) {
  const queryClient = useQueryClient();

  return useMutation<FreeChatSettings, Error, FreeChatSettings>({
    mutationFn: async (settings: FreeChatSettings) => {
      const { data } = await request<ApiResponse<FreeChatSettings>>(
        api.saveFreeChatSettings,
        {
          method: 'POST',
          data: settings,
        },
      );

      if (data.code === 102) {
        throw new UnauthorizedError('User not authorized');
      }

      if (data.code !== 0) {
        throw new Error(data.message || 'Failed to save settings');
      }

      return data.data;
    },
    // 乐观更新
    onMutate: async (newSettings) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({
        queryKey: freeChatKeys.settings(userId),
      });

      // 保存之前的值用于回滚
      const previous = queryClient.getQueryData<FreeChatSettings>(
        freeChatKeys.settings(userId),
      );

      // 乐观更新缓存
      queryClient.setQueryData(freeChatKeys.settings(userId), newSettings);

      return { previous };
    },
    onError: (err, newSettings, context) => {
      // 回滚
      if (context?.previous) {
        queryClient.setQueryData(
          freeChatKeys.settings(userId),
          context.previous,
        );
      }
      logError(err.message, 'useSaveFreeChatSettings');
    },
    onSuccess: (data) => {
      logInfo(`Saved settings for user ${userId}`, 'useSaveFreeChatSettings');
    },
    onSettled: () => {
      // 无论成功失败都重新获取
      queryClient.invalidateQueries({
        queryKey: freeChatKeys.settings(userId),
      });
    },
  });
}

// ==================== 自动保存 Hook ====================

interface UseAutoSaveOptions {
  debounceMs?: number;
  onSave?: (settings: FreeChatSettings) => void;
  onError?: (error: Error) => void;
}

/**
 * 自动保存 Hook（带防抖）
 */
export function useAutoSaveSettings(
  userId: string,
  options: UseAutoSaveOptions = {},
) {
  const { debounceMs = 30000, onSave, onError } = options;
  const { mutate } = useSaveFreeChatSettings(userId);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedSave = useCallback(
    (settings: FreeChatSettings) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        mutate(settings, {
          onSuccess: () => onSave?.(settings),
          onError: (error) => onError?.(error as Error),
        });
      }, debounceMs);
    },
    [mutate, debounceMs, onSave, onError],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedSave;
}

// ==================== 字段更新 Hook ====================

/**
 * 字段更新 Hook
 * 提供单个字段更新功能，支持自动保存
 */
export function useUpdateSettingsField(userId: string) {
  const queryClient = useQueryClient();
  const autoSave = useAutoSaveSettings(userId);
  const { mutate: saveMutation } = useSaveFreeChatSettings(userId);

  const updateField = useCallback(
    <K extends keyof Omit<FreeChatSettings, 'user_id'>>(
      field: K,
      value: FreeChatSettings[K],
      options: UpdateFieldOptions = {},
    ) => {
      const { silent = false, immediate = false } = options;

      // 获取当前设置
      const currentSettings = queryClient.getQueryData<FreeChatSettings>(
        freeChatKeys.settings(userId),
      );

      if (!currentSettings) return;

      // 创建新设置
      const newSettings = {
        ...currentSettings,
        [field]: value,
      };

      // 立即更新缓存
      queryClient.setQueryData(freeChatKeys.settings(userId), newSettings);

      // 保存
      if (immediate) {
        // 立即保存
        saveMutation(newSettings);
      } else if (!silent) {
        // 自动保存（防抖）
        autoSave(newSettings);
      }
    },
    [userId, queryClient, autoSave, saveMutation],
  );

  return updateField;
}

// ==================== 手动保存 Hook ====================

/**
 * 手动保存 Hook
 * 追踪未保存的更改并提供手动保存功能
 */
export function useManualSaveSettings(userId: string) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useSaveFreeChatSettings(userId);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const savedSettingsRef = useRef<FreeChatSettings | null>(null);

  // 监控设置变化以检测未保存的更改
  const currentSettings = queryClient.getQueryData<FreeChatSettings>(
    freeChatKeys.settings(userId),
  );

  useEffect(() => {
    if (currentSettings) {
      // 初始化保存的设置引用
      if (!savedSettingsRef.current) {
        savedSettingsRef.current = currentSettings;
        return;
      }

      // 检查是否有更改
      const hasChanges =
        JSON.stringify(currentSettings) !==
        JSON.stringify(savedSettingsRef.current);
      setHasUnsavedChanges(hasChanges);
    }
  }, [currentSettings]);

  const manualSave = useCallback(async (): Promise<boolean> => {
    const settingsToSave = queryClient.getQueryData<FreeChatSettings>(
      freeChatKeys.settings(userId),
    );

    if (!settingsToSave) return false;

    return new Promise((resolve) => {
      mutate(settingsToSave, {
        onSuccess: () => {
          savedSettingsRef.current = settingsToSave;
          setHasUnsavedChanges(false);
          resolve(true);
        },
        onError: () => resolve(false),
      });
    });
  }, [userId, queryClient, mutate]);

  return {
    manualSave,
    isSaving: isPending,
    hasUnsavedChanges,
  };
}

// ==================== 合并 Hook（向后兼容） ====================

/**
 * 完整的设置管理 Hook
 * 兼容旧的 API，但内部使用 React Query
 */
export function useFreeChatSettingsApi(userId: string) {
  const { data: settings, isLoading, error } = useFreeChatSettings(userId);
  const { mutate, isPending: isSaving } = useSaveFreeChatSettings(userId);
  const updateField = useUpdateSettingsField(userId);
  const { manualSave } = useManualSaveSettings(userId);
  const queryClient = useQueryClient();

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: freeChatKeys.settings(userId),
    });
  }, [userId, queryClient]);

  // 检测未保存更改
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  return {
    settings: settings || null,
    loading: isLoading,
    saving: isSaving,
    error: error?.message || null,
    hasUnsavedChanges,
    updateField: (field: any, value: any, options?: UpdateFieldOptions) => {
      updateField(field, value, options);
      if (!options?.silent) {
        setHasUnsavedChanges(true);
      }
    },
    manualSave: async () => {
      const result = await manualSave();
      if (result) {
        setHasUnsavedChanges(false);
      }
      return result;
    },
    reload,
  };
}
