import { useMemo, useRef, useState } from 'react';
import { Helmet } from 'umi';
import { v4 as uuid } from 'uuid';

import { MessageType } from '@/constants/chat';
import type { Message } from '@/interfaces/database/chat';
import { ChatInterface } from './chat-interface';
import { ControlPanel } from './components/control-panel';
import { SessionList } from './components/session-list';
import type { IFreeChatSession } from './hooks/use-free-chat-session';

const now = Date.now();

const INITIAL_SESSIONS: IFreeChatSession[] = [
  {
    id: 'session-product-launch',
    conversation_id: 'demo-001',
    name: '新品发布会问答',
    created_at: now - 1000 * 60 * 60 * 36,
    updated_at: now - 1000 * 60 * 60 * 8,
    messages: [
      {
        id: 'session-product-launch-user',
        role: MessageType.User,
        content: '请帮我梳理一下新品发布会直播的流程，重点突出互动玩法。',
      },
      {
        id: 'session-product-launch-bot',
        role: MessageType.Assistant,
        content:
          '当然可以。建议按照「暖场-亮点演示-互动抽奖-Q&A-收尾」五个阶段执行，每个阶段提前准备主持稿与素材，互动玩法可以采用直播弹幕投票 + 小程序抽奖的形式。',
      },
    ],
    message_count: 2,
    is_favorite: false,
  },
  {
    id: 'session-knowledge-refresh',
    conversation_id: 'demo-002',
    name: '知识库更新规划',
    created_at: now - 1000 * 60 * 60 * 72,
    updated_at: now - 1000 * 60 * 30,
    messages: [
      {
        id: 'session-knowledge-user',
        role: MessageType.User,
        content: '我们计划在周五更新 FAQ 知识库，帮我列一下核对清单。',
      },
      {
        id: 'session-knowledge-bot',
        role: MessageType.Assistant,
        content:
          '建议从「原始文档」「向量索引」「对话路由」「监控回归」四个维度逐项核对：1) 收集新增问题；2) 重新构建索引并验证；3) 更新默认 Bot 的知识库绑定；4) 使用回归数据集跑一次示例对话。',
      },
    ],
    message_count: 2,
    is_favorite: true,
  },
];

const DEFAULT_DRAFT_MESSAGES: Message[] = [
  {
    id: 'draft-welcome',
    role: MessageType.Assistant,
    content:
      '欢迎来到 FreeChat 测试模式！此处展示的是「草稿对话」效果，所有内容仅存储在本地。输入第一条消息后即可预览气泡样式，确认无误后再对接真实后端。',
  },
];

const MOCK_USER_ID = 'freechat-demo-user';
const MOCK_TEAM_NAME = '演示团队';
const MOCK_IS_SUPER_USER = true;

const MOCK_KNOWLEDGE_BASES = ['企业产品手册', '常见问题 FAQ', '发布会脚本模板'];
const MOCK_DIALOG_OPTIONS = [
  { label: '默认助理（演示）', value: 'dlg-default' },
  { label: '产品专家 Bot', value: 'dlg-product' },
  { label: '运营助手', value: 'dlg-ops' },
];

// 模拟流式响应的回复函数
const createStreamingReply = async (
  question: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
) => {
  const fullReply = `✳️ 已记录你的草稿问题：\n\n> ${question}\n\n当 FreeChat 连接真实模型后，这里会自动返回正式答案。`;

  // 模拟打字效果：每30ms输出一个字符
  for (let i = 0; i < fullReply.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    onChunk(fullReply.slice(0, i + 1));
  }
  onComplete();
};

export default function FreeChatTestPage() {
  const [sessions, setSessions] =
    useState<IFreeChatSession[]>(INITIAL_SESSIONS);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isDraftMode, setIsDraftMode] = useState<boolean>(true);
  const [draftMessages, setDraftMessages] = useState<Message[]>(
    DEFAULT_DRAFT_MESSAGES,
  );
  const [inputValue, setInputValue] = useState('');
  // For ChatInterface scrolling
  const scrollAnchor = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId),
    [sessions, currentSessionId],
  );

  const activeMessages = isDraftMode
    ? draftMessages
    : currentSession?.messages ?? [];

  const handleDraftSelect = () => {
    setIsDraftMode(true);
    setCurrentSessionId('');
  };

  const handleSessionSelect = (sessionId: string | null) => {
    if (!sessionId) {
      handleDraftSelect();
      return;
    }
    setIsDraftMode(false);
    setCurrentSessionId(sessionId);
  };

  const handleSessionRename = (sessionId: string, name: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              name,
            }
          : session,
      ),
    );
  };

  const handleSessionDelete = (sessionId: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    if (currentSessionId === sessionId) {
      handleDraftSelect();
    }
  };

  const handleClearHistory = () => {
    setSessions((prev) => {
      const favorites = prev.filter((session) => session.is_favorite);

      if (favorites.length === prev.length) {
        return prev;
      }

      if (!favorites.length) {
        handleDraftSelect();
      } else if (
        !favorites.some((session) => session.id === currentSessionId)
      ) {
        setIsDraftMode(false);
        setCurrentSessionId(favorites[0].id);
      }

      return favorites;
    });
  };

  const handleToggleFavorite = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, is_favorite: !session.is_favorite }
          : session,
      ),
    );
  };

  const handleNewSession = () => {
    handleDraftSelect();
    // 保持草稿消息固定，不重置
    setInputValue('');
  };

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: uuid(),
      role: MessageType.User,
      content: trimmed,
    };

    const assistantMessageId = uuid();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: MessageType.Assistant,
      content: '',
    };

    if (isDraftMode) {
      setDraftMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInputValue('');

      // 模拟流式响应
      await createStreamingReply(
        trimmed,
        (chunk) => {
          setDraftMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: chunk } : msg,
            ),
          );
        },
        () => {
          // 完成
        },
      );
    } else if (currentSessionId) {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== currentSessionId) return session;
          const nextMessages = [
            ...session.messages,
            userMessage,
            assistantMessage,
          ];
          return {
            ...session,
            messages: nextMessages,
            message_count: nextMessages.length,
            updated_at: Date.now(),
          };
        }),
      );
      setInputValue('');

      // 模拟流式响应
      await createStreamingReply(
        trimmed,
        (chunk) => {
          setSessions((prev) =>
            prev.map((session) => {
              if (session.id !== currentSessionId) return session;
              return {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: chunk }
                    : msg,
                ),
              };
            }),
          );
        },
        () => {
          // 完成
        },
      );
    }
  };

  // ===== Static Control Panel (no network) =====
  const [selectedDialogId, setSelectedDialogId] = useState('dlg-default');
  const [rolePrompt, setRolePrompt] = useState(
    '你是企业知识库助手，请用中文、结构化地回答。',
  );
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [enabledKBs, setEnabledKBs] = useState<string[]>(['企业产品手册']);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const toggleKB = (name: string) => {
    setEnabledKBs((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <Helmet>
        <title>FreeChat Test Mode</title>
      </Helmet>
      <SessionList
        sessions={sessions}
        currentSessionId={isDraftMode ? '' : currentSessionId}
        isDraftMode={isDraftMode}
        onDraftSelect={handleDraftSelect}
        onSessionSelect={handleSessionSelect}
        onSessionDelete={handleSessionDelete}
        onSessionRename={handleSessionRename}
        onNewSession={handleNewSession}
        onClearAll={handleClearHistory}
        variant="mockTest"
        onToggleFavorite={handleToggleFavorite}
        userId={MOCK_USER_ID}
        teamName={MOCK_TEAM_NAME}
        isSuperUser={MOCK_IS_SUPER_USER}
      />
      <main className="relative flex min-w-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col border-r bg-muted/10">
          <ChatInterface
            messages={activeMessages}
            onSendMessage={handleSendMessage}
            onInputChange={(e) => setInputValue(e.target.value)}
            inputValue={inputValue}
            sendLoading={false}
            scrollRef={scrollAnchor}
            messageContainerRef={messageContainerRef}
            stopOutputMessage={() => {}}
            removeMessageById={() => {}}
            regenerateMessage={() => {}}
            dialogId={isDraftMode ? '' : currentSession?.conversation_id || ''}
            userAvatar={''}
            userNickname={'User'}
            disableUserInfoFetch
            onCreateNewSession={handleNewSession}
            onOpenSettings={() => setIsPanelOpen((prev) => !prev)}
            isSettingsPanelOpen={isPanelOpen}
          />
        </div>
        {isPanelOpen && (
          <aside className="hidden w-full max-w-[360px] lg:flex">
            <ControlPanel
              dialogId={selectedDialogId}
              onDialogChange={setSelectedDialogId}
              rolePrompt={rolePrompt}
              onRolePromptChange={setRolePrompt}
              modelParams={{ temperature, top_p: topP, max_tokens: maxTokens }}
              onModelParamsChange={(p) => {
                setTemperature(p.temperature ?? temperature);
                setTopP(p.top_p ?? topP);
                setMaxTokens(p.max_tokens ?? maxTokens);
              }}
              saving={false}
              hasUnsavedChanges={false}
              onManualSave={() => {}}
              mockDialogs={MOCK_DIALOG_OPTIONS.map((x) => ({
                id: x.value,
                name: x.label,
              }))}
              mockKBs={MOCK_KNOWLEDGE_BASES.map((name, i) => ({
                id: `kb-${i}`,
                name,
                chunk_num: i * 3 + 1,
              }))}
              mockEnabledKBs={
                new Set(
                  enabledKBs
                    .map((name) => {
                      const idx = MOCK_KNOWLEDGE_BASES.indexOf(name);
                      return idx >= 0 ? `kb-${idx}` : undefined;
                    })
                    .filter((id): id is string => Boolean(id)),
                )
              }
              onToggleMockKB={(id) => {
                const idx = Number(String(id).split('kb-')[1] || -1);
                const name = idx >= 0 ? MOCK_KNOWLEDGE_BASES[idx] : undefined;
                if (name) {
                  toggleKB(name);
                }
              }}
              onClosePanel={() => setIsPanelOpen(false)}
            />
          </aside>
        )}
      </main>
    </div>
  );
}
