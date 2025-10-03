import MessageItem from '@/components/message-item';
import { NextMessageInput } from '@/components/message-input/next';
import { MessageType } from '@/constants/chat';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { buildMessageUuidWithRole } from '@/utils/chat';
import { Message } from '@/interfaces/database/chat';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslate } from '@/hooks/common-hooks';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendLoading: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  messageContainerRef: React.RefObject<HTMLDivElement>;
  stopOutputMessage: () => void;
  removeMessageById: (messageId: string) => void;
  removeAllMessages: () => void;
  regenerateMessage: (message: Message) => void;
  dialogId: string;
}

export function ChatInterface({
  messages,
  onSendMessage,
  onInputChange,
  inputValue,
  setInputValue,
  sendLoading,
  scrollRef,
  messageContainerRef,
  stopOutputMessage,
  removeMessageById,
  removeAllMessages,
  regenerateMessage,
  dialogId,
}: ChatInterfaceProps) {
  const { data: userInfo } = useFetchUserInfo();
  const { t } = useTranslate('chat');

  return (
    <section className="flex flex-col p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">{t('freeChat')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('freeChatDescription')}
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={removeAllMessages}
            disabled={sendLoading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('clearAll')}
          </Button>
        )}
      </div>

      {/* Dialog Setup Alert */}
      {!dialogId && (
        <Alert className="mb-4">
          <AlertDescription>
            {t('selectDialogToStartChatting')}
          </AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <div ref={messageContainerRef} className="flex-1 overflow-auto min-h-0">
        <div className="w-full pr-5">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <h2 className="text-xl font-semibold">{t('startFreeChat')}</h2>
                <p className="text-muted-foreground max-w-md">
                  {t('freeChatWelcomeMessage')}
                </p>
              </div>
            </div>
          ) : (
            messages.map((message, i) => {
              return (
                <MessageItem
                  loading={
                    message.role === MessageType.Assistant &&
                    sendLoading &&
                    messages.length - 1 === i
                  }
                  key={buildMessageUuidWithRole(message)}
                  item={message}
                  nickname={userInfo.nickname}
                  avatar={userInfo.avatar}
                  avatarDialog={''} // Free chat doesn't have dialog avatar
                  reference={(message as any).reference}
                  clickDocumentButton={() => {}}
                  index={i}
                  removeMessageById={removeMessageById}
                  regenerateMessage={regenerateMessage}
                  sendLoading={sendLoading}
                />
              );
            })
          )}
        </div>
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <NextMessageInput
        disabled={false}
        sendDisabled={!inputValue.trim() || sendLoading}
        sendLoading={sendLoading}
        value={inputValue}
        onInputChange={onInputChange}
        onPressEnter={onSendMessage}
        conversationId=""
        stopOutputMessage={stopOutputMessage}
        isUploading={false}
        removeFile={() => {}}
      />
    </section>
  );
}
