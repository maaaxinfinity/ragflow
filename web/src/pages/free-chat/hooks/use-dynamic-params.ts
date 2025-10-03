import { useCallback, useState, useEffect } from 'react';
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

  // Sync with external params changes
  useEffect(() => {
    if (initialParams) {
      setParams(initialParams);
    }
  }, [initialParams]);

  // Save params callback
  const saveParams = useCallback(
    (newParams: DynamicModelParams) => {
      onParamsChange?.(newParams);
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

  // BUG FIX #5 & #6: Reset should NOT set changed flag - resetting means no changes
  // 重置参数
  const resetParams = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    saveParams(DEFAULT_PARAMS);
    // Reset means no changes, so clear the flag
    setParamsChanged(false);
  }, [saveParams]);

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
