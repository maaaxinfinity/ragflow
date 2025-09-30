import { MessageType } from '@/constants/chat';
import { useGetFileIcon } from '@/pages/chat/hooks';

import { useSendAgentMessage } from './use-send-agent-message';

import { FileUploadProps } from '@/components/file-upload';
import { NextMessageInput } from '@/components/message-input/next';
import MessageItem from '@/components/next-message-item';
import PdfDrawer from '@/components/pdf-drawer';
import { useClickDrawer } from '@/components/pdf-drawer/hooks';
import {
  useFetchAgent,
  useUploadCanvasFileWithProgress,
} from '@/hooks/use-agent-request';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { buildMessageUuidWithRole } from '@/utils/chat';
import { memo, useCallback, useState } from 'react';
import { useParams } from 'umi';
import DebugContent from '../debug-content';
import { useAwaitCompentData } from '../hooks/use-chat-logic';
import { useIsTaskMode } from '../hooks/use-get-begin-query';
import { KnowledgeBaseSelector } from './knowledge-base-selector';

function AgentChatBox() {
  const { data: canvasInfo, refetch } = useFetchAgent();
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [kbEnabled, setKbEnabled] = useState<boolean>(false);

  const {
    value,
    scrollRef,
    messageContainerRef,
    sendLoading,
    derivedMessages,
    handleInputChange,
    handlePressEnter,
    stopOutputMessage,
    sendFormMessage,
    findReferenceByMessageId,
    appendUploadResponseList,
    sessionId,
  } = useSendAgentMessage({
    refetch,
    kbIds: kbEnabled ? selectedKbIds : [],
    kbEnabled
  });

  const { visible, hideModal, documentId, selectedChunk, clickDocumentButton } =
    useClickDrawer();
  useGetFileIcon();
  const { data: userInfo } = useFetchUserInfo();
  const { id: canvasId } = useParams();
  const { uploadCanvasFile, loading } = useUploadCanvasFileWithProgress();

  const { buildInputList, handleOk, isWaitting } = useAwaitCompentData({
    derivedMessages,
    sendFormMessage,
    canvasId: canvasId as string,
  });

  const isTaskMode = useIsTaskMode();

  const handleUploadFile: NonNullable<FileUploadProps['onUpload']> =
    useCallback(
      async (files, options) => {
        const ret = await uploadCanvasFile({ files, options });
        appendUploadResponseList(ret.data, files);
      },
      [appendUploadResponseList, uploadCanvasFile],
    );

  const handleKbChange = useCallback(
    (kbIds: string[], enabled: boolean) => {
      setSelectedKbIds(kbIds);
      // 这里可以添加保存到sessionStorage的逻辑，以便页面刷新后恢复
      if (sessionId) {
        sessionStorage.setItem(`agent_kb_${sessionId}`, JSON.stringify({ kbIds, enabled }));
      }
    },
    [sessionId]
  );

  const handleKbToggle = useCallback(
    (enabled: boolean) => {
      setKbEnabled(enabled);
      if (sessionId) {
        const stored = sessionStorage.getItem(`agent_kb_${sessionId}`);
        if (stored) {
          const data = JSON.parse(stored);
          sessionStorage.setItem(`agent_kb_${sessionId}`, JSON.stringify({ ...data, enabled }));
        }
      }
    },
    [sessionId]
  );

  return (
    <>
      <section className="flex flex-1 flex-col px-5 min-h-0 pb-4">
        <div className="flex-1 overflow-auto" ref={messageContainerRef}>
          <div>
            {/* <Spin spinning={sendLoading}> */}
            {derivedMessages?.map((message, i) => {
              return (
                <MessageItem
                  loading={
                    message.role === MessageType.Assistant &&
                    sendLoading &&
                    derivedMessages.length - 1 === i
                  }
                  key={buildMessageUuidWithRole(message)}
                  nickname={userInfo.nickname}
                  avatar={userInfo.avatar}
                  avatarDialog={canvasInfo.avatar}
                  item={message}
                  reference={findReferenceByMessageId(message.id)}
                  clickDocumentButton={clickDocumentButton}
                  index={i}
                  showLikeButton={false}
                  sendLoading={sendLoading}
                >
                  {message.role === MessageType.Assistant &&
                    derivedMessages.length - 1 === i && (
                      <DebugContent
                        parameters={buildInputList(message)}
                        message={message}
                        ok={handleOk(message)}
                        isNext={false}
                        btnText={'Submit'}
                      ></DebugContent>
                    )}
                  {message.role === MessageType.Assistant &&
                    derivedMessages.length - 1 !== i && (
                      <div>
                        <div>{message?.data?.tips}</div>

                        <div>
                          {buildInputList(message)?.map((item) => item.value)}
                        </div>
                      </div>
                    )}
                </MessageItem>
              );
            })}
            {/* </Spin> */}
          </div>
          <div ref={scrollRef} />
        </div>
        {isTaskMode || (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <KnowledgeBaseSelector
                sessionId={sessionId}
                selectedKbIds={selectedKbIds}
                onKbChange={handleKbChange}
                onKbToggle={handleKbToggle}
                kbEnabled={kbEnabled}
              />
            </div>
            <NextMessageInput
              value={value}
              sendLoading={sendLoading}
              disabled={isWaitting}
              sendDisabled={sendLoading || isWaitting}
              isUploading={loading || isWaitting}
              onPressEnter={handlePressEnter}
              onInputChange={handleInputChange}
              stopOutputMessage={stopOutputMessage}
              onUpload={handleUploadFile}
              conversationId=""
            />
          </div>
        )}
      </section>
      <PdfDrawer
        visible={visible}
        hideModal={hideModal}
        documentId={documentId}
        chunk={selectedChunk}
      ></PdfDrawer>
    </>
  );
}

export default memo(AgentChatBox);
