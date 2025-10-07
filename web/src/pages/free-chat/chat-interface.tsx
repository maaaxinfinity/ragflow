import MessageItem from '@/components/message-item';
import { MessageType } from '@/constants/chat';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { buildMessageUuidWithRole } from '@/utils/chat';
import { Message } from '@/interfaces/database/chat';
import { Button } from '@/components/ui/button';
import { Trash2, Settings, ChevronRight, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslate } from '@/hooks/common-hooks';

interface ChatInterfaceProps {
  messages: Message[];
  sendLoading: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  messageContainerRef: React.RefObject<HTMLDivElement>;
  removeMessageById: (messageId: string) => void;
  removeAllMessages: () => void;
  regenerateMessage: (message: Message) => void;
  dialogId: string;
  // User and dialog avatar props
  userAvatar?: string;
  userNickname?: string;
  dialogAvatar?: string;
  // Breadcrumb props
  sessionName?: string;
  modelCardName?: string;
  // Settings panel control
  isSettingsPanelOpen?: boolean;
  onToggleSettingsPanel?: () => void;
}

export function ChatInterface({
  messages,
  sendLoading,
  scrollRef,
  messageContainerRef,
  removeMessageById,
  removeAllMessages,
  regenerateMessage,
  dialogId,
  userAvatar,
  userNickname,
  dialogAvatar,
  sessionName,
  modelCardName,
  isSettingsPanelOpen,
  onToggleSettingsPanel,
}: ChatInterfaceProps) {
  const { data: userInfo } = useFetchUserInfo();
  const { t } = useTranslate('chat');

  // Use provided avatar/nickname or fallback to userInfo
  const displayAvatar = userAvatar || userInfo.avatar;
  const displayNickname = userNickname || userInfo.nickname;

  return (
    <section className="flex flex-col h-full bg-gradient-to-b from-background to-muted/10">
      {/* Header with Breadcrumb */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card/50 backdrop-blur-sm">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {sessionName && (
            <>
              <div className="px-3 py-1.5 border rounded-md bg-background text-sm truncate max-w-xs">
                {sessionName}
              </div>
              {modelCardName && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="px-3 py-1.5 border rounded-md bg-primary/10 border-primary/30 text-sm truncate max-w-xs">
                    {modelCardName}
                  </div>
                </>
              )}
            </>
          )}
          {!sessionName && (
            <div className="text-sm text-muted-foreground">
              {t('selectSessionToStart', '请选择或创建一个对话')}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
          {onToggleSettingsPanel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleSettingsPanel}
              className={isSettingsPanelOpen ? 'bg-primary/10' : ''}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
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
                  nickname={displayNickname}
                  avatar={displayAvatar}
                  avatarDialog={dialogAvatar || ''}
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
    </section>
  );
}
