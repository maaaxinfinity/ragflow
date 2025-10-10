import { Button } from '@/components/ui/button';
import { MessageSquarePlus, MessageSquare, ChevronLeft, ChevronRight, Sparkles, Pencil, Trash2, Check, X, MessageSquareDashed } from 'lucide-react';
import { IFreeChatSession } from '../hooks/use-free-chat-session';
import { useFetchModelCards } from '../hooks/use-fetch-model-cards';
import { useTranslate } from '@/hooks/common-hooks';
import { useState, useMemo } from 'react';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import { Input } from '@/components/ui/input';

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
  onSessionRename?: (sessionId: string, newName: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  // User info props (detailed)
  userId?: string;
  currentUserInfo?: any;
  userInfo?: any;
  tenantInfo?: any;
  // Legacy props (for backward compatibility)
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
  onSessionRename,
  onSessionDelete,
  userId,
  currentUserInfo,
  userInfo,
  tenantInfo,
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
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Fetch model cards
  const { data: modelCards = [], isLoading } = useFetchModelCards();

  // Filter sessions by current model card and separate draft from active
  const { draftSession, activeSessions } = useMemo(() => {
    const filtered = currentModelCardId 
      ? sessions.filter(s => s.model_card_id === currentModelCardId)
      : sessions;
    
    const draft = filtered.find(s => s.state === 'draft');
    const actives = filtered.filter(s => s.state !== 'draft');
    
    return { draftSession: draft, activeSessions: actives };
  }, [sessions, currentModelCardId]);

  return (
    <div className={`border-r flex flex-col h-full bg-gradient-to-b from-background to-muted/20 transition-all duration-300 relative ${
      isCollapsed ? 'w-0 border-0' : 'w-96'
    }`}>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 h-20 w-8 rounded-r-md border bg-background shadow-md hover:shadow-lg transition-all"
        title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
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
                          // FIX: Clarified assistant card click behavior
                          // Find all sessions associated with this model card
                          const cardSessions = sessions.filter(s => s.model_card_id === card.id);
                          if (cardSessions.length > 0) {
                            // Has existing sessions: switch to the most recently updated one
                            const latest = cardSessions.sort((a, b) => b.updated_at - a.updated_at)[0];
                            onSessionSelect(latest.id);
                          } else {
                            // No existing sessions: create a new session with this model card
                            // onModelCardSelect triggers handleModelCardChange in parent component
                            // which calls createSession('新对话', newModelCardId)
                            onModelCardSelect(card.id);
                          }
                          // Always switch to Topics tab to show the session list
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
                {/* Draft Session */}
                {draftSession && (
                  <div className="mb-3">
                    <div
                      onClick={() => onSessionSelect(draftSession.id)}
                      className={`group relative p-3 rounded-lg transition-all duration-200 cursor-pointer border-2 border-dashed ${
                        currentSessionId === draftSession.id
                          ? 'bg-amber-50/50 border-amber-400 shadow-md'
                          : 'bg-card/50 border-muted-foreground/30 hover:border-amber-300 hover:bg-amber-50/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          currentSessionId === draftSession.id
                            ? 'bg-amber-100'
                            : 'bg-muted'
                        }`}>
                          <MessageSquareDashed className={`h-5 w-5 ${
                            currentSessionId === draftSession.id
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {draftSession.name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                              草稿
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            点击开始对话
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Divider */}
                <div className="flex items-center gap-2 my-4 px-2">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {draftSession ? '历史对话' : '对话列表'}
                  </span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>
                
                {!currentModelCardId ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      请先选择一个助手
                    </p>
                  </div>
                ) : activeSessions.length === 0 && !draftSession ? (
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
                  activeSessions.map((session) => {
                    const isActive = currentSessionId === session.id;
                    const card = modelCards.find(c => c.id === session.model_card_id);
                    const isEditing = editingSessionId === session.id;

                    return (
                      <div
                        key={session.id}
                        className={`group relative p-3 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-primary/10 shadow-md border-2 border-primary/30'
                            : 'bg-card hover:bg-accent hover:shadow-sm border border-transparent'
                        } ${!isEditing && 'cursor-pointer'}`}
                        onClick={() => !isEditing && onSessionSelect(session.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2 mb-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      await onSessionRename?.(session.id, editingName);
                                      setEditingSessionId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingSessionId(null);
                                    }
                                  }}
                                  className="h-7 text-sm flex-1"
                                  autoFocus
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={async () => {
                                    await onSessionRename?.(session.id, editingName);
                                    setEditingSessionId(null);
                                  }}
                                >
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => setEditingSessionId(null)}
                                >
                                  <X className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <div className="font-medium text-sm truncate mb-1">
                                {session.name}
                              </div>
                            )}
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
                              {!session.model_card_id && (
                                <>
                                  <span className="text-xs text-red-500 font-medium">⚠️ 缺少助手</span>
                                  <span>•</span>
                                </>
                              )}
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {session.messages?.length ?? 0}
                              </span>
                              <span>•</span>
                              <span>{formatTimeAgo(session.updated_at, t)}</span>
                            </div>
                          </div>
                          {!isEditing && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingSessionId(session.id);
                                  setEditingName(session.name);
                                }}
                                title="重命名"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={async () => {
                                  if (window.confirm(`确定要删除"${session.name}"吗？`)) {
                                    await onSessionDelete?.(session.id);
                                  }
                                }}
                                title="删除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer - User Info */}
          <div className="border-t space-y-3 p-3 bg-card/50 backdrop-blur-sm">
            {/* User Profile */}
            {userId && (currentUserInfo || userInfo) && (
              <div className="flex items-center gap-3 bg-card/95 backdrop-blur-md border-2 border-primary/20 rounded-xl px-4 py-2.5 shadow-lg hover:shadow-xl transition-all duration-200">
                <RAGFlowAvatar
                  name={(userInfo?.nickname || userInfo?.email) || (currentUserInfo?.nickname || currentUserInfo?.email) || 'User'}
                  avatar={userInfo?.avatar || currentUserInfo?.avatar}
                  isPerson={true}
                  className="w-9 h-9 ring-2 ring-primary/20"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-semibold flex items-center gap-2 truncate">
                    {(userInfo?.nickname || userInfo?.email) || (currentUserInfo?.nickname || currentUserInfo?.email) || 'User'}
                    {userInfo?.is_su && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                        SU
                      </span>
                    )}
                  </span>
                  {((userInfo?.nickname && userInfo?.email) || (currentUserInfo?.nickname && currentUserInfo?.email)) && (
                    <span className="text-xs text-muted-foreground truncate">
                      {userInfo?.email || currentUserInfo?.email}
                    </span>
                  )}
                  {tenantInfo?.name && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="truncate">团队：{tenantInfo.name}</span>
                    </span>
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
