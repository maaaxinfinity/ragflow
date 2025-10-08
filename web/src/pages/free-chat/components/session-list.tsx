import { Button } from '@/components/ui/button';
import { MessageSquarePlus, MessageSquare, Trash2, Eraser, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
import { IFreeChatSession } from '../hooks/use-free-chat-session';
import { useTranslate } from '@/hooks/common-hooks';
import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';

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
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, newName: string) => void;
  onNewSession: () => void;
  onClearAll?: () => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onNewSession,
  onClearAll,
}: SessionListProps) {
  const { t } = useTranslate('chat');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // Mobile: default collapsed (< 768px), Desktop: default expanded
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const handleStartEdit = useCallback((session: IFreeChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingName(session.name);
  }, []);

  const handleSaveEdit = useCallback((sessionId: string) => {
    if (editingName.trim() && onSessionRename) {
      onSessionRename(sessionId, editingName.trim());
    }
    setEditingSessionId(null);
    setEditingName('');
  }, [editingName, onSessionRename]);

  const handleCancelEdit = useCallback(() => {
    setEditingSessionId(null);
    setEditingName('');
  }, []);

  return (
    <div className={`border-r flex flex-col h-full bg-gradient-to-b from-background to-muted/20 transition-all duration-300 relative ${
      isCollapsed ? 'w-14' : 'w-72'
    }`}>
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
      <div className="flex-1 overflow-y-auto p-2">
        {isCollapsed ? (
          // Collapsed view - just dots or icons
          <div className="space-y-2">
            {sessions.map((session) => {
              const isActive = currentSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className={`w-10 h-10 mx-auto rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center ${
                    isActive
                      ? 'bg-primary/20 border-2 border-primary/50'
                      : 'bg-card hover:bg-accent border border-transparent'
                  }`}
                  onClick={() => onSessionSelect(session.id)}
                  title={session.name}
                >
                  <MessageSquare className="h-4 w-4" />
                </div>
              );
            })}
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t('noConversationsYet')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const isEditing = editingSessionId === session.id;
              const isActive = currentSessionId === session.id;

              return (
                <div
                  key={session.id}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 shadow-md border-2 border-primary/30'
                      : 'bg-card hover:bg-accent hover:shadow-sm border border-transparent'
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - Controls */}
      <div className="p-3 border-t space-y-2 bg-card/50 backdrop-blur-sm">
        {isCollapsed ? (
          <>
            <Button
              onClick={onNewSession}
              className="w-full shadow-sm"
              size="icon"
              title={t('newChat')}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
            {onClearAll && sessions.length > 0 && (
              <Button
                onClick={onClearAll}
                variant="outline"
                className="w-full"
                size="icon"
                title="清除全部"
              >
                <Eraser className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={onNewSession}
              className="w-full shadow-sm"
              size="sm"
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              {t('newChat')}
            </Button>
            {onClearAll && sessions.length > 0 && (
              <Button
                onClick={onClearAll}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Eraser className="h-4 w-4 mr-2" />
                清除全部
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
