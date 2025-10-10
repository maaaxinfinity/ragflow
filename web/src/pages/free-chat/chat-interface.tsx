import { NextMessageInput } from '@/components/message-input/next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { Message } from '@/interfaces/database/chat';
import { MessageCircle, Trash2 } from 'lucide-react';
// ✅ 导入虚拟滚动组件
import { VirtualMessageList } from './components/virtual-message-list';

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
  // User and dialog avatar props
  userAvatar?: string;
  userNickname?: string;
  dialogAvatar?: string;
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
  userAvatar,
  userNickname,
  dialogAvatar,
}: ChatInterfaceProps) {
  const { data: userInfo } = useFetchUserInfo();
  const { t } = useTranslate('chat');

  // Use provided avatar/nickname or fallback to userInfo
  const displayAvatar = userAvatar || userInfo.avatar;
  const displayNickname = userNickname || userInfo.nickname;

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

      {/* Messages - 使用虚拟滚动优化 */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">{t('startFreeChat')}</h2>
            <p className="text-muted-foreground max-w-md">
              {t('freeChatWelcomeMessage')}
            </p>
          </div>
        </div>
      ) : (
        <VirtualMessageList
          messages={messages}
          sendLoading={sendLoading}
          nickname={displayNickname}
          avatar={displayAvatar}
          dialogAvatar={dialogAvatar || ''}
          removeMessageById={removeMessageById}
          regenerateMessage={regenerateMessage}
          scrollRef={scrollRef}
        />
      )}

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
