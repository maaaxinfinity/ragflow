import { Button } from '@/components/ui/button';
import { MessageSquarePlus, Trash2, Eraser } from 'lucide-react';
import { IFreeChatSession } from '../hooks/use-free-chat-session';
import { useTranslate } from '@/hooks/common-hooks';

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
  onNewSession: () => void;
  onClearAll?: () => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSessionSelect,
  onSessionDelete,
  onNewSession,
  onClearAll,
}: SessionListProps) {
  const { t } = useTranslate('chat');

  return (
    <div className="w-64 border-r flex flex-col h-full bg-background">
      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t('noConversationsYet')}
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative p-3 border-b cursor-pointer hover:bg-accent transition-colors ${
                currentSessionId === session.id ? 'bg-accent' : ''
              }`}
              onClick={() => onSessionSelect(session.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {session.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {session.messages.length} {t('messages')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTimeAgo(session.updated_at, t)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSessionDelete(session.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer - Controls */}
      <div className="p-4 border-t space-y-2">
        <Button
          onClick={onNewSession}
          className="w-full"
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
      </div>
    </div>
  );
}
