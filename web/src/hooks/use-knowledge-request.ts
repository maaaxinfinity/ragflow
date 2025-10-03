import { useHandleFilterSubmit } from '@/components/list-filter-bar/use-handle-filter-submit';
import message from '@/components/ui/message';
import {
  IKnowledge,
  IKnowledgeGraph,
  IKnowledgeResult,
  INextTestingResult,
} from '@/interfaces/database/knowledge';
import { ITestRetrievalRequestBody } from '@/interfaces/request/knowledge';
import i18n from '@/locales/config';
import kbService, {
  deleteKnowledgeGraph,
  getKnowledgeGraph,
  listDataset,
} from '@/services/knowledge-service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from 'antd';
import { useDebounce } from 'ahooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'umi';
import {
  useGetPaginationWithRouter,
  useHandleSearchChange,
} from './logic-hooks';

export const enum KnowledgeApiAction {
  TestRetrieval = 'testRetrieval',
  FetchKnowledgeListByPage = 'fetchKnowledgeListByPage',
  CreateKnowledge = 'createKnowledge',
  DeleteKnowledge = 'deleteKnowledge',
  SaveKnowledge = 'saveKnowledge',
  FetchKnowledgeDetail = 'fetchKnowledgeDetail',
  FetchKnowledgeGraph = 'fetchKnowledgeGraph',
  FetchMetadata = 'fetchMetadata',
  RemoveKnowledgeGraph = 'removeKnowledgeGraph',
}

export const useKnowledgeBaseId = (): string => {
  const { id } = useParams();

  return (id as string) || '';
};

export const useTestRetrieval = () => {
  const knowledgeBaseId = useKnowledgeBaseId();
  const [values, setValues] = useState<ITestRetrievalRequestBody>();
  const mountedRef = useRef(false);
  const { filterValue, handleFilterSubmit } = useHandleFilterSubmit();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const onPaginationChange = useCallback((page: number, pageSize: number) => {
    setPage(page);
    setPageSize(pageSize);
  }, []);

  const queryParams = useMemo(() => {
    return {
      ...values,
      kb_id: values?.kb_id || knowledgeBaseId,
      page,
      size: pageSize,
      doc_ids: filterValue.doc_ids,
    };
  }, [filterValue, knowledgeBaseId, page, pageSize, values]);

  const {
    data,
    isFetching: loading,
    refetch,
  } = useQuery<INextTestingResult>({
    queryKey: [KnowledgeApiAction.TestRetrieval, queryParams, page, pageSize],
    initialData: {
      chunks: [],
      doc_aggs: [],
      total: 0,
      isRuned: false,
    },
    enabled: false,
    gcTime: 0,
    queryFn: async () => {
      const { data } = await kbService.retrieval_test(queryParams);
      const result = data?.data ?? {};
      return { ...result, isRuned: true };
    },
  });

  useEffect(() => {
    if (mountedRef.current) {
      refetch();
    }
    mountedRef.current = true;
  }, [page, pageSize, refetch, filterValue]);

  return {
    data,
    loading,
    setValues,
    refetch,
    onPaginationChange,
    page,
    pageSize,
    handleFilterSubmit,
    filterValue,
  };
};

export const useFetchNextKnowledgeListByPage = () => {
  const { searchString, handleInputChange } = useHandleSearchChange();
  const { pagination, setPagination } = useGetPaginationWithRouter();
  const debouncedSearchString = useDebounce(searchString, { wait: 500 });
  const { filterValue, handleFilterSubmit } = useHandleFilterSubmit();

  const { data, isFetching: loading } = useQuery<IKnowledgeResult>({
    queryKey: [
      KnowledgeApiAction.FetchKnowledgeListByPage,
      {
        debouncedSearchString,
        ...pagination,
        filterValue,
      },
    ],
    initialData: {
      kbs: [],
      total: 0,
    },
    gcTime: 0,
    queryFn: async () => {
      const { data } = await listDataset(
        {
          keywords: debouncedSearchString,
          page_size: pagination.pageSize,
          page: pagination.current,
        },
        {
          owner_ids: filterValue.owner,
        },
      );

      return data?.data;
    },
  });

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      // setPagination({ page: 1 }); // TODO: 这里导致重复请求
      handleInputChange(e);
    },
    [handleInputChange],
  );

  return {
    ...data,
    searchString,
    handleInputChange: onInputChange,
    pagination: { ...pagination, total: data?.total },
    setPagination,
    loading,
    filterValue,
    handleFilterSubmit,
  };
};

export const useCreateKnowledge = () => {
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: [KnowledgeApiAction.CreateKnowledge],
    mutationFn: async (params: { id?: string; name: string }) => {
      const { data = {} } = await kbService.createKb(params);
      if (data.code === 0) {
        message.success(
          i18n.t(`message.${params?.id ? 'modified' : 'created'}`),
        );
        queryClient.invalidateQueries({ queryKey: ['fetchKnowledgeList'] });
      }
      return data;
    },
  });

  return { data, loading, createKnowledge: mutateAsync };
};

export const useDeleteKnowledge = () => {
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: [KnowledgeApiAction.DeleteKnowledge],
    mutationFn: async (id: string) => {
      const { data } = await kbService.rmKb({ kb_id: id });
      if (data.code === 0) {
        message.success(i18n.t(`message.deleted`));
        queryClient.invalidateQueries({
          queryKey: [KnowledgeApiAction.FetchKnowledgeListByPage],
        });
      }
      return data?.data ?? [];
    },
  });

  return { data, loading, deleteKnowledge: mutateAsync };
};

export const useUpdateKnowledge = (shouldFetchList = false) => {
  const knowledgeBaseId = useKnowledgeBaseId();
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: [KnowledgeApiAction.SaveKnowledge],
    mutationFn: async (params: Record<string, any>) => {
      const { data = {} } = await kbService.updateKb({
        kb_id: params?.kb_id ? params?.kb_id : knowledgeBaseId,
        ...params,
      });
      if (data.code === 0) {
        message.success(i18n.t(`message.updated`));

        // Check if parser_config changed and prompt user to reparse documents
        const kbData = data.data || {};
        if (kbData.parser_config_changed && kbData.docs_to_reparse_count > 0) {
          Modal.confirm({
            title: i18n.t('knowledge.parserConfigChangedTitle', '切片配置已更新'),
            content: i18n.t(
              'knowledge.parserConfigChangedContent',
              `检测到您修改了切片配置，当前有 ${kbData.docs_to_reparse_count} 个已完成的文档需要重新解析才能应用新配置。\n\n是否立即重新解析所有文档？`,
              { count: kbData.docs_to_reparse_count }
            ),
            okText: i18n.t('knowledge.reparseNow', '立即重新解析'),
            cancelText: i18n.t('knowledge.reparseLater', '稍后手动解析'),
            width: 520,
            onOk: async () => {
              try {
                // Fetch all completed documents
                const { data: listData } = await kbService.document_list({
                  kb_id: params?.kb_id || knowledgeBaseId,
                  page: 1,
                  page_size: 9999,
                });

                if (listData?.data?.docs) {
                  // Filter only completed documents (run === '0' means DONE)
                  const completedDocIds = listData.data.docs
                    .filter((doc: any) => doc.run === '0')
                    .map((doc: any) => doc.id);

                  if (completedDocIds.length > 0) {
                    // Batch reparse all completed documents
                    const { data: runData } = await kbService.document_run({
                      doc_ids: completedDocIds,
                      run: 2, // 2 = running
                      delete: true, // Delete old chunks
                    });

                    if (runData?.code === 0) {
                      message.success(
                        i18n.t(
                          'knowledge.reparseSubmitted',
                          `已提交 ${completedDocIds.length} 个文档重新解析`,
                          { count: completedDocIds.length }
                        )
                      );
                    } else {
                      message.error(runData?.message || i18n.t('message.operationFailed'));
                    }
                  }
                }
              } catch (error) {
                console.error('Reparse documents failed:', error);
                message.error(i18n.t('message.operationFailed'));
              }
            },
          });
        }

        if (shouldFetchList) {
          queryClient.invalidateQueries({
            queryKey: [KnowledgeApiAction.FetchKnowledgeListByPage],
          });
        } else {
          queryClient.invalidateQueries({ queryKey: ['fetchKnowledgeDetail'] });
        }
      }
      return data;
    },
  });

  return { data, loading, saveKnowledgeConfiguration: mutateAsync };
};

export const useFetchKnowledgeBaseConfiguration = (refreshCount?: number) => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const knowledgeBaseId = searchParams.get('id') || id;

  let queryKey: (KnowledgeApiAction | number)[] = [
    KnowledgeApiAction.FetchKnowledgeDetail,
  ];
  if (typeof refreshCount === 'number') {
    queryKey = [KnowledgeApiAction.FetchKnowledgeDetail, refreshCount];
  }

  const { data, isFetching: loading } = useQuery<IKnowledge>({
    queryKey,
    initialData: {} as IKnowledge,
    gcTime: 0,
    queryFn: async () => {
      const { data } = await kbService.get_kb_detail({
        kb_id: knowledgeBaseId,
      });
      return data?.data ?? {};
    },
  });

  return { data, loading };
};

export function useFetchKnowledgeGraph() {
  const knowledgeBaseId = useKnowledgeBaseId();

  const { data, isFetching: loading } = useQuery<IKnowledgeGraph>({
    queryKey: [KnowledgeApiAction.FetchKnowledgeGraph, knowledgeBaseId],
    initialData: { graph: {}, mind_map: {} } as IKnowledgeGraph,
    enabled: !!knowledgeBaseId,
    gcTime: 0,
    queryFn: async () => {
      const { data } = await getKnowledgeGraph(knowledgeBaseId);
      return data?.data;
    },
  });

  return { data, loading };
}

export function useFetchKnowledgeMetadata(kbIds: string[] = []) {
  const { data, isFetching: loading } = useQuery<
    Record<string, Record<string, string[]>>
  >({
    queryKey: [KnowledgeApiAction.FetchMetadata, kbIds],
    initialData: {},
    enabled: kbIds.length > 0,
    gcTime: 0,
    queryFn: async () => {
      const { data } = await kbService.getMeta({ kb_ids: kbIds.join(',') });
      return data?.data ?? {};
    },
  });

  return { data, loading };
}

export const useRemoveKnowledgeGraph = () => {
  const knowledgeBaseId = useKnowledgeBaseId();

  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: [KnowledgeApiAction.RemoveKnowledgeGraph],
    mutationFn: async () => {
      const { data } = await deleteKnowledgeGraph(knowledgeBaseId);
      if (data.code === 0) {
        message.success(i18n.t(`message.deleted`));
        queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeGraph'],
        });
      }
      return data?.code;
    },
  });

  return { data, loading, removeKnowledgeGraph: mutateAsync };
};
