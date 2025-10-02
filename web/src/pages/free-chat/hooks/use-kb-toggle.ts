import { useFetchKnowledgeList } from '@/hooks/knowledge-hooks';
import { DocumentParserType } from '@/constants/knowledge';
import { useCallback, useState, useEffect } from 'react';
import { logError } from '../utils/error-handler';

const STORAGE_KEY = 'free_chat_enabled_kbs';

export const useKBToggle = () => {
  const [enabledKBs, setEnabledKBs] = useState<Set<string>>(new Set());

  // 使用现有的hook获取知识库列表
  const { list: knowledgeList, loading } = useFetchKnowledgeList(true);

  // 过滤掉Tag类型的知识库（与next-chats保持一致）
  const availableKBs = knowledgeList.filter(
    (x) => x.parser_id !== DocumentParserType.Tag,
  );

  // 从localStorage加载已启用的知识库
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const kbIds = JSON.parse(saved);
        setEnabledKBs(new Set(kbIds));
      } catch (e) {
        logError(
          e instanceof Error ? e : 'failedToParseSavedKBIds',
          'useKBToggle.loadKBs'
        );
      }
    }
  }, []);

  // 保存到localStorage
  const saveEnabledKBs = useCallback((kbSet: Set<string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(kbSet)));
  }, []);

  // 切换单个知识库
  const toggleKB = useCallback(
    (kbId: string) => {
      setEnabledKBs((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(kbId)) {
          newSet.delete(kbId);
        } else {
          newSet.add(kbId);
        }
        saveEnabledKBs(newSet);
        return newSet;
      });
    },
    [saveEnabledKBs],
  );

  // 批量设置知识库
  const setKBs = useCallback(
    (kbIds: string[]) => {
      const newSet = new Set(kbIds);
      setEnabledKBs(newSet);
      saveEnabledKBs(newSet);
    },
    [saveEnabledKBs],
  );

  // 清空所有知识库
  const clearKBs = useCallback(() => {
    setEnabledKBs(new Set());
    saveEnabledKBs(new Set());
  }, [saveEnabledKBs]);

  // 全选/取消全选
  // BUG FIX #14: Don't depend on enabledKBs.size directly, use enabledKBs object
  const toggleAll = useCallback(() => {
    if (enabledKBs.size === availableKBs.length) {
      clearKBs();
    } else {
      const allIds = availableKBs.map((kb) => kb.id);
      setKBs(allIds);
    }
  }, [enabledKBs, availableKBs, clearKBs, setKBs]);

  return {
    enabledKBs,
    availableKBs,
    loading,
    toggleKB,
    setKBs,
    clearKBs,
    toggleAll,
    isAllSelected: enabledKBs.size === availableKBs.length && availableKBs.length > 0,
  };
};
