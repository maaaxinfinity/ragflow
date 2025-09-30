import { useState, useEffect } from 'react';
import { useFetchKnowledgeList } from '@/hooks/knowledge-hooks';

export const useFetchKnowledgeBaseList = () => {
  const { list, fetchList, loading } = useFetchKnowledgeList();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setData(list);
  }, [list]);

  return {
    data,
    loading,
    refetch: fetchList,
  };
};