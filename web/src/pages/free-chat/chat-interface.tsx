import MessageItem from '@/components/message-item';
import { NextMessageInput } from '@/components/message-input/next';
import { MessageType } from '@/constants/chat';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { buildMessageUuidWithRole } from '@/utils/chat';
import { Message } from '@/interfaces/database/chat';
import { Button } from '@/components/ui/button';
import { Trash2, MessageCircle } from 'lucide-react';
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
    <section className="flex flex-col h-full bg-gradient-to-b from-background to-muted/10">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('freeChat')}</h1>
            <p className="text-xs text-muted-foreground">
              {t('freeChatDescription')}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={removeAllMessages}
            disabled={sendLoading}
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('clearAll')}
          </Button>
        )}
      </div>

      {/* Dialog Setup Alert */}
      {!dialogId && (
        <div className="mx-6 mt-4">
          <Alert className="border-primary/50 bg-primary/5">
            <AlertDescription className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              {t('selectDialogToStartChatting')}
            </AlertDescription>
          </Alert>
        </div>
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
