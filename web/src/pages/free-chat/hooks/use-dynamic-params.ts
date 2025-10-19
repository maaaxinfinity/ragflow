import { useCallback, useEffect, useRef, useState } from 'react';
import { DynamicModelParams } from '../types';

const DEFAULT_PARAMS: DynamicModelParams = {
  temperature: 0.7,
  top_p: 0.9,
  frequency_penalty: 0,
  presence_penalty: 0,
  max_tokens: 2000,
};

interface UseDynamicParamsProps {
  initialParams?: DynamicModelParams;
  onParamsChange?: (params: DynamicModelParams) => void;
}

export const useDynamicParams = (props?: UseDynamicParamsProps) => {
  const { initialParams, onParamsChange } = props || {};
  const [params, setParams] = useState<DynamicModelParams>(
    initialParams || DEFAULT_PARAMS,
  );
  const [paramsChanged, setParamsChanged] = useState(false);

  // Debounce timer ref
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with external params changes
  useEffect(() => {
    if (initialParams) {
      setParams(initialParams);
    }
  }, [initialParams]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Save params callback with debounce
  const saveParams = useCallback(
    (newParams: DynamicModelParams) => {
      // Clear previous timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Set new timer - save after 500ms of no changes
      saveTimerRef.current = setTimeout(() => {
        onParamsChange?.(newParams);
      }, 500);
    },
    [onParamsChange],
  );

  // 更新单个参数
  const updateParam = useCallback(
    (key: keyof DynamicModelParams, value: number) => {
      setParams((prev) => {
        const newParams = { ...prev, [key]: value };
        saveParams(newParams);
        setParamsChanged(true);
        return newParams;
      });
    },
    [saveParams],
  );

  // 批量更新参数
  const updateParams = useCallback(
    (newParams: Partial<DynamicModelParams>) => {
      setParams((prev) => {
        const updated = { ...prev, ...newParams };
        saveParams(updated);
        setParamsChanged(true);
        return updated;
      });
    },
    [saveParams],
  );

  // 重置参数：优先回到当前传入的 initialParams（相当于“刷新/撤销未保存更改”），无则回到内建默认
  const resetParams = useCallback(() => {
    const target = initialParams ?? DEFAULT_PARAMS;
    setParams(target);
    // 刷新/撤销操作不触发保存，仅恢复视图
    setParamsChanged(false);
  }, [initialParams]);

  // 清除参数变化标记
  const clearChangedFlag = useCallback(() => {
    setParamsChanged(false);
  }, []);

  return {
    params,
    updateParam,
    updateParams,
    resetParams,
    paramsChanged,
    clearChangedFlag,
  };
};
