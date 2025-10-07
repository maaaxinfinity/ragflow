import { Button } from '@/components/ui/button';
import { MessageSquarePlus, MessageSquare, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { IFreeChatSession } from '../hooks/use-free-chat-session';
import { useFetchModelCards } from '../hooks/use-fetch-model-cards';
import { useTranslate } from '@/hooks/common-hooks';
import { useState, useMemo } from 'react';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';

const formatTimeAgo = (timestamp: number, t: any) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('justNow', 'Just now');
  if (minutes < 60) return `${minutes}${t('minutesAgo', 'm ago')}`;
  if (hours < 24) return `${hours}${t('hoursAgo', 'h ago')}`;
  return `${days}${t('daysAgo', 'd ago')}`;
};

interface SidebarDualTabsProps {
  sessions: IFreeChatSession[];
  currentSessionId: string;
  currentModelCardId?: number;
  onSessionSelect: (sessionId: string) => void;
  onModelCardSelect: (modelCardId: number) => void;
  onNewSession: () => void;
  // User info props
  userAvatar?: string;
  userNickname?: string;
  teamName?: string;
}

export function SidebarDualTabs({
  sessions,
  currentSessionId,
  currentModelCardId,
  onSessionSelect,
  onModelCardSelect,
  onNewSession,
  userAvatar,
  userNickname,
  teamName,
}: SidebarDualTabsProps) {
  const { t } = useTranslate('chat');
  const [activeTab, setActiveTab] = useState<'assistants' | 'topics'>('assistants');
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  // Fetch model cards
  const { data: modelCards = [], isLoading } = useFetchModelCards();

  // Filter sessions by current model card
  const filteredSessions = useMemo(() => {
    if (!currentModelCardId) return sessions;
    return sessions.filter(s => s.model_card_id === currentModelCardId);
  }, [sessions, currentModelCardId]);

  return (
    <div className={`border-r flex flex-col h-full bg-gradient-to-b from-background to-muted/20 transition-all duration-300 relative ${
      isCollapsed ? 'w-0 border-0' : 'w-72'
    }`}>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 h-16 w-6 rounded-r-md border bg-background shadow-md hover:shadow-lg transition-all"
        title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {!isCollapsed && (
        <>
          {/* Tabs Header */}
          <div className="flex border-b bg-card/50 backdrop-blur-sm">
            <button
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                activeTab === 'assistants'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('assistants')}
            >
              助手
              {activeTab === 'assistants' && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
            <button
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                activeTab === 'topics'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('topics')}
            >
              话题
              {activeTab === 'topics' && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Assistants (Model Cards) Tab */}
            {activeTab === 'assistants' && (
              <div className="space-y-2">
                {isLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    加载中...
                  </div>
                ) : modelCards.length === 0 ? (
                  <div className="p-8 text-center">
                    <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      暂无可用助手
                    </p>
                  </div>
                ) : (
                  modelCards.map((card) => {
                    const cardSessions = sessions.filter(s => s.model_card_id === card.id);
                    const isActive = currentModelCardId === card.id;

                    return (
                      <div
                        key={card.id}
                        className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          isActive
                            ? 'bg-primary/10 shadow-md border-2 border-primary/30'
                            : 'bg-card hover:bg-accent hover:shadow-sm border border-transparent'
                        }`}
                        onClick={() => {
                          onModelCardSelect(card.id);
                          setActiveTab('topics');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {card.name}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {cardSessions.length}
                              </span>
                            </div>
                          </div>
                        </div>
                        {card.description && (
                          <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {card.description}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Topics (Sessions) Tab */}
            {activeTab === 'topics' && (
              <div className="space-y-2">
                {!currentModelCardId ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      请先选择一个助手
                    </p>
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      暂无对话
                    </p>
                    <Button
                      onClick={onNewSession}
                      className="mt-4"
                      size="sm"
                    >
                      <MessageSquarePlus className="h-4 w-4 mr-2" />
                      新建对话
                    </Button>
                  </div>
                ) : (
                  filteredSessions.map((session) => {
                    const isActive = currentSessionId === session.id;
                    const card = modelCards.find(c => c.id === session.model_card_id);

                    return (
                      <div
                        key={session.id}
                        className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          isActive
                            ? 'bg-primary/10 shadow-md border-2 border-primary/30'
                            : 'bg-card hover:bg-accent hover:shadow-sm border border-transparent'
                        }`}
                        onClick={() => onSessionSelect(session.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate mb-1">
                              {session.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {card && (
                                <>
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    {card.name}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {session.messages.length}
                              </span>
                              <span>•</span>
                              <span>{formatTimeAgo(session.updated_at, t)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer - User Info & New Chat */}
          <div className="border-t space-y-3 p-3 bg-card/50 backdrop-blur-sm">
            {/* New Chat Button */}
            {activeTab === 'topics' && currentModelCardId && (
              <Button
                onClick={onNewSession}
                className="w-full shadow-sm"
                size="sm"
              >
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                新建对话
              </Button>
            )}

            {/* User Profile */}
            {(userNickname || teamName) && (
              <div className="flex items-center gap-3 p-2 border border-border rounded-lg bg-background/50">
                <RAGFlowAvatar
                  name={userNickname || 'User'}
                  avatar={userAvatar}
                  isPerson={true}
                  className="w-10 h-10"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {userNickname || 'User'}
                  </div>
                  {teamName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="truncate">{teamName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
