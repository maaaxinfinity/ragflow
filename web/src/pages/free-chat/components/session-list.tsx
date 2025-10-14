import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslate } from '@/hooks/common-hooks';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eraser,
  MessageSquare,
  MessageSquarePlus,
  Sparkles,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { IFreeChatSession } from '../hooks/use-free-chat-session';

const formatTimeAgo = (timestamp: number, t: any) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('justNow');
  if (minutes < 60) return `${minutes}${t('minutesAgo')}`;
  if (hours < 24) return `${hours}${t('hoursAgo')}`;
  return `${days}${t('daysAgo')}`;
};

interface SessionListProps {
  sessions: IFreeChatSession[];
  currentSessionId: string;
  isDraftMode: boolean;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, newName: string) => void;
  onNewSession: () => void;
  onClearAll?: () => void;
  onDraftSelect: () => void;
  variant?: 'default' | 'mockTest';
  userId?: string;
  teamName?: string;
  isSuperUser?: boolean;
  onToggleFavorite?: (sessionId: string) => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  isDraftMode,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onNewSession,
  onClearAll,
  onDraftSelect,
  variant = 'default',
  userId,
  teamName,
  isSuperUser = false,
  onToggleFavorite,
}: SessionListProps) {
  const { t } = useTranslate('chat');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const draftTitle = '来聊点啥';
  const hasRemovableSessions = sessions.some((session) => !session.is_favorite);
  // UX: 不再在左下角显示用户/团队卡片，按需保留 props 但不使用

  const handleStartEdit = useCallback(
    (session: IFreeChatSession, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingSessionId(session.id);
      setEditingName(session.name);
    },
    [],
  );

  const handleSaveEdit = useCallback(
    (sessionId: string) => {
      if (editingName.trim() && onSessionRename) {
        onSessionRename(sessionId, editingName.trim());
      }
      setEditingSessionId(null);
      setEditingName('');
    },
    [editingName, onSessionRename],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingSessionId(null);
    setEditingName('');
  }, []);

  return (
    <div
      className={`border-r flex flex-col h-full bg-gradient-to-b from-background to-muted/20 transition-all duration-300 relative ${
        isCollapsed ? 'w-14' : 'w-72'
      }`}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-4 -right-3 z-20 h-6 w-6 rounded-full border bg-background shadow-md hover:shadow-lg transition-all"
        title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Header */}
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
        {!isCollapsed && (
          <>
            <h2 className="text-lg font-semibold mb-1">对话历史</h2>
            <p className="text-xs text-muted-foreground">
              {sessions.length} 个会话
            </p>
          </>
        )}
        {isCollapsed && (
          <div className="flex items-center justify-center">
            <MessageSquarePlus className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {!isCollapsed &&
          (variant === 'mockTest' ? (
            <>
              <div
                className={`relative overflow-hidden rounded-2xl border p-4 cursor-pointer transition-all duration-300 ${
                  isDraftMode
                    ? 'border-primary/60 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_70%)] shadow-[0_18px_45px_-30px_rgba(59,130,246,0.85)]'
                    : 'border-dashed border-border/70 bg-card/70 hover:border-primary/40 hover:bg-primary/5'
                }`}
                onClick={onDraftSelect}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/15 p-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold tracking-wide text-primary">
                      {draftTitle}
                    </h3>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="h-1 w-12 rounded-full bg-primary/50" />
                      <span className="h-1 w-6 rounded-full bg-primary/20" />
                    </div>
                  </div>
                </div>
              </div>
              {sessions.length > 0 && (
                <div className="mt-4 border-t border-dashed border-border/70" />
              )}
            </>
          ) : (
            <div
              className={`group relative overflow-hidden rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                isDraftMode
                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30 shadow-sm'
                  : 'border-border/60 bg-card hover:bg-accent hover:border-primary/30'
              }`}
              onClick={onDraftSelect}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    {draftTitle}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {t('freeChatWelcomeMessage')}
                  </p>
                </div>
              </div>
            </div>
          ))}

        {isCollapsed ? (
          <div className="space-y-2">
            <div
              className={`group relative w-10 h-10 mx-auto rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center ${
                variant === 'mockTest'
                  ? isDraftMode
                    ? 'bg-primary/25 border border-primary/50 ring-1 ring-primary/30 shadow-[0_6px_12px_-8px_rgba(59,130,246,0.35)]'
                    : 'bg-card/70 border border-transparent hover:border-primary/30 hover:bg-primary/10'
                  : isDraftMode
                    ? 'bg-primary/25 border border-primary/50 ring-1 ring-primary/25 shadow-[0_6px_14px_-9px_rgba(59,130,246,0.4)]'
                    : 'bg-card/80 border border-border/60 hover:border-primary/30 hover:bg-primary/10'
              }`}
              onClick={onDraftSelect}
              title={draftTitle}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            {sessions.map((session) => {
              const isActive = currentSessionId === session.id && !isDraftMode;
              const isFavorite = Boolean(session.is_favorite);
              return (
                <div
                  key={session.id}
                  className={`group relative w-10 h-10 mx-auto rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center ${
                    variant === 'mockTest'
                      ? isActive
                        ? 'bg-primary/25 border border-primary/60 ring-1 ring-primary/35 shadow-[0_6px_15px_-10px_rgba(59,130,246,0.55)]'
                        : 'bg-card/70 border border-transparent hover:border-primary/30 hover:bg-primary/10'
                      : isActive
                        ? 'bg-primary/25 border border-primary/60 ring-1 ring-primary/35 shadow-[0_6px_15px_-10px_rgba(59,130,246,0.55)]'
                        : 'bg-card/80 border border-border/60 hover:border-primary/30 hover:bg-primary/10'
                  } ${
                    isFavorite
                      ? 'border-amber-300 ring-2 ring-amber-300 bg-amber-50/70 shadow-[0_10px_22px_-12px_rgba(251,191,36,0.55)]'
                      : ''
                  }`}
                  onClick={() => onSessionSelect(session.id)}
                  title={session.name}
                >
                  <MessageSquare className="h-4 w-4" />
                  {onToggleFavorite && (
                    <button
                      type="button"
                      className={`absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-white/80 bg-background/90 shadow-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                        isFavorite ? 'text-amber-500' : 'text-muted-foreground'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(session.id);
                      }}
                    >
                      {isFavorite ? (
                        <Star className="h-3 w-3 fill-amber-400" />
                      ) : (
                        <StarOff className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 opacity-60" />
            <p className="text-sm">{t('noConversationsYet')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const isEditing = editingSessionId === session.id;
              const isActive = currentSessionId === session.id && !isDraftMode;
              const isFavorite = Boolean(session.is_favorite);

              return (
                <div
                  key={session.id}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    variant === 'mockTest'
                      ? isActive
                        ? 'border border-primary/50 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_70%)] shadow-[0_20px_45px_-28px_rgba(59,130,246,0.9)] ring-1 ring-primary/25'
                        : 'bg-card/80 border border-transparent hover:border-primary/30 hover:bg-primary/5'
                      : isActive
                        ? 'bg-primary/10 shadow-md border-2 border-primary/30'
                        : 'bg-card hover:bg-accent hover:shadow-sm border border-transparent'
                  } ${
                    isFavorite
                      ? 'border border-amber-300/70 ring-2 ring-amber-300 bg-amber-50/60 shadow-[0_18px_38px_-18px_rgba(251,191,36,0.55)]'
                      : ''
                  }`}
                  onClick={() => !isEditing && onSessionSelect(session.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit(session.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          onBlur={() => handleSaveEdit(session.id)}
                          autoFocus
                          className="h-7 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <div className="font-medium text-sm truncate mb-1">
                            {session.name}
                            {isFavorite && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                                收藏
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {session.messages?.length ?? 0}
                            </span>
                            <span>•</span>
                            <span>{formatTimeAgo(session.updated_at, t)}</span>
                          </div>
                        </>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex gap-1 items-center">
                        {onToggleFavorite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${
                              isFavorite
                                ? 'text-amber-500 hover:bg-amber-500/15'
                                : 'hover:bg-primary/20'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(session.id);
                            }}
                          >
                            {isFavorite ? (
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                            ) : (
                              <StarOff className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onSessionRename && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-primary/20"
                              onClick={(e) => handleStartEdit(session, e)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSessionDelete(session.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - Controls */}
      <div className="p-3 border-t bg-card/50 backdrop-blur-sm space-y-3">
        <div>
          {isCollapsed ? (
            <>
              <Button
                onClick={onNewSession}
                className="w-full h-10 shadow-sm"
                size="icon"
                title={t('newChat')}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
              {onClearAll && sessions.length > 0 && (
                <Button
                  onClick={onClearAll}
                  variant="outline"
                  className="w-full h-10"
                  size="icon"
                  title="清除全部（已收藏保留）"
                  disabled={!hasRemovableSessions}
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={onNewSession}
                className="w-full h-10 shadow-sm"
                size="default"
              >
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                {t('newChat')}
              </Button>
              {onClearAll && sessions.length > 0 && (
                <Button
                  onClick={onClearAll}
                  variant="outline"
                  className="w-full h-10"
                  size="default"
                  disabled={!hasRemovableSessions}
                >
                  <Eraser className="h-4 w-4 mr-2" />
                  清除全部（已收藏保留）
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
