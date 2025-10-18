import { NextMessageInput } from '@/components/message-input/next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { Message } from '@/interfaces/database/chat';
import {
  Briefcase,
  FileText,
  Loader2,
  MessageCircle,
  Scale,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
// ✅ 导入虚拟滚动组件
import { VirtualMessageList } from './components/virtual-message-list';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  inputValue: string;
  sendLoading: boolean;
  messagesLoading?: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  messageContainerRef: React.RefObject<HTMLDivElement>;
  stopOutputMessage: () => void;
  removeMessageById: (messageId: string) => void;
  regenerateMessage: (message: Message) => void;
  dialogId: string;
  // User and dialog avatar props
  userAvatar?: string;
  userNickname?: string;
  dialogAvatar?: string;
  // Test mode: disable internal user info fetching
  disableUserInfoFetch?: boolean;
  onOpenSettings?: () => void;
  isSettingsPanelOpen?: boolean;
  onCreateNewSession?: () => void;
}

export function ChatInterface({
  messages,
  onSendMessage,
  onInputChange,
  inputValue,
  sendLoading,
  scrollRef,
  messageContainerRef,
  stopOutputMessage,
  removeMessageById,
  regenerateMessage,
  dialogId,
  userAvatar,
  userNickname,
  dialogAvatar,
  disableUserInfoFetch,
  onOpenSettings,
  isSettingsPanelOpen,
  onCreateNewSession,
  messagesLoading = false,
}: ChatInterfaceProps) {
  const { data: userInfo } = useFetchUserInfo(!(disableUserInfoFetch === true));
  const { t } = useTranslate('chat');

  // Use provided avatar/nickname or fallback to userInfo
  const displayAvatar = userAvatar || userInfo.avatar;
  const displayNickname =
    userNickname || userInfo.nickname || userInfo.email || 'User';
  const assistantAvatar = dialogAvatar || '/lawyer-message.svg';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return '早上好';
    if (h < 13) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  })();

  const prefillInput = (text: string) => {
    // 仅预填输入框，避免异步发送时机问题
    onInputChange({ target: { value: text } } as any);
  };

  return (
    <section className="relative flex flex-col h-full bg-gradient-to-b from-background to-muted/10">
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
      </div>

      {/* Removed inline settings button - now using floating button */}
      {false && onOpenSettings && (
        <Button
          variant={isSettingsPanelOpen ? 'default' : 'outline'}
          size="sm"
          onClick={onOpenSettings}
          className="flex items-center gap-2"
        >
          <Settings2 className="h-4 w-4" />
          {t('settings', { defaultValue: 'Settings' })}
        </Button>
      )}

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
      {messagesLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>正在加载对话记录...</span>
          </div>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl px-6 py-10">
            {/* Greeting */}
            <div className="text-center mb-8">
              <div className="text-2xl font-bold flex items-center justify-center gap-2">
                <span>👋 {greeting}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                我是您的法律智能助手，可协助合同审阅、合规审查、劳动纠纷咨询、知识产权等法律问题。
              </p>
            </div>

            {/* Recommended assistants */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() =>
                  prefillInput(
                    '请帮我审阅一份合同，重点关注违约责任和争议解决条款。',
                  )
                }
                className="text-left rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">合同审阅助手</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      识别风险条款并给出修订建议
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  prefillInput('请做一次隐私与数据合规自查，给出整改建议。')
                }
                className="text-left rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">合规检查助手</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      隐私、数据安全与企业合规要点检查
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  prefillInput(
                    '员工提出离职，公司是否需要支付经济补偿？请说明依据和计算方式。',
                  )
                }
                className="text-left rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">劳动纠纷咨询</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      加班、裁员、赔偿等常见问题解答
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  prefillInput('我要注册商标/申请专利，流程与材料有哪些？')
                }
                className="text-left rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Scale className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">知识产权顾问</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      商标、专利、著作权流程与文书要点
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Suggested questions */}
            <div className="mt-8">
              <div className="text-sm text-muted-foreground mb-3">
                大家都在问：
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  '劳动合同试用期最多多久？',
                  '解除劳动合同需要支付补偿吗？',
                  '保密协议（NDA）需要包含哪些条款？',
                  '员工竞业限制补偿如何计算？',
                  '网站/应用的隐私政策需要写什么？',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => prefillInput(q)}
                    className="px-3 py-1.5 rounded-full text-xs border bg-card hover:bg-accent transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <VirtualMessageList
          messages={messages}
          sendLoading={sendLoading}
          nickname={displayNickname}
          avatar={displayAvatar}
          dialogAvatar={assistantAvatar}
          removeMessageById={removeMessageById}
          regenerateMessage={regenerateMessage}
          scrollRef={scrollRef}
          containerRef={messageContainerRef}
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
        onCreateNewSession={onCreateNewSession}
        showCreateSessionButton
      />

      {/* Floating Settings Button */}
      {onOpenSettings && (
        <Button
          variant={isSettingsPanelOpen ? 'default' : 'outline'}
          size="icon"
          onClick={onOpenSettings}
          className="fixed bottom-24 right-6 lg:bottom-28 lg:right-8 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 border-2"
          title={t('settings', { defaultValue: 'Settings' })}
        >
          <Settings2 className="h-6 w-6" />
        </Button>
      )}
    </section>
  );
}
