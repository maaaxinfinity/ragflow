import { useState, useCallback } from 'react';
import { useConnectToKnowledge } from '@/hooks/file-manager-hooks';
import { useParams } from 'umi';
import { useQueryClient } from '@tanstack/react-query';

export const useSelectFilesFromManager = () => {
  const [fileSelectorVisible, setFileSelectorVisible] = useState(false);
  const { id: knowledgeId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { connectFileToKnowledge, loading } = useConnectToKnowledge();

  const showFileSelectorModal = useCallback(() => {
    setFileSelectorVisible(true);
  }, []);

  const hideFileSelectorModal = useCallback(() => {
    setFileSelectorVisible(false);
  }, []);

  const onFileSelectorOk = useCallback(
    async (fileIds: string[]) => {
      if (!knowledgeId || fileIds.length === 0) return;

      try {
        await connectFileToKnowledge({
          fileIds,
          kbIds: [knowledgeId],
        });
        hideFileSelectorModal();
        // Invalidate and refetch the document list
        queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
      } catch (error) {
        console.error('Failed to connect files to knowledge base:', error);
      }
    },
    [knowledgeId, connectFileToKnowledge, hideFileSelectorModal, queryClient],
  );

  return {
    fileSelectorVisible,
    showFileSelectorModal,
    hideFileSelectorModal,
    onFileSelectorOk,
    fileSelectorLoading: loading,
  };
};
