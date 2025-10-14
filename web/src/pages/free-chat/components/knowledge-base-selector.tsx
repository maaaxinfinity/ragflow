import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslate } from '@/hooks/common-hooks';
import { CheckCheck, X } from 'lucide-react';
import { useOptionalKBContext } from '../contexts/kb-context';

export function KnowledgeBaseSelector({
  mockKBs,
  mockEnabled,
  onToggleMock,
}: {
  mockKBs?: Array<{
    id: string;
    name: string;
    avatar?: string;
    chunk_num?: number;
  }>;
  mockEnabled?: Set<string>;
  onToggleMock?: (id: string) => void;
}) {
  const { t } = useTranslate('chat');
  const { t: tCommon } = useTranslate('common');
  const ctx = useOptionalKBContext();
  const usingMock = Array.isArray(mockKBs);
  const enabledKBs = usingMock
    ? mockEnabled ?? new Set<string>()
    : ctx?.enabledKBs ?? new Set<string>();
  const availableKBs = usingMock ? mockKBs! : ctx?.availableKBs ?? [];
  const loading = usingMock ? false : !!ctx?.loading;
  const toggleKB = usingMock
    ? onToggleMock ?? (() => {})
    : ctx?.toggleKB ?? (() => {});
  const toggleAll = usingMock ? () => {} : ctx?.toggleAll ?? (() => {});
  const clearKBs = usingMock ? () => {} : ctx?.clearKBs ?? (() => {});
  const isAllSelected = usingMock ? false : !!ctx?.isAllSelected;

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{t('knowledgeBases')}</Label>
        <div className="text-sm text-muted-foreground">
          {tCommon('loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t('knowledgeBases')}</Label>
        <div className="flex gap-1">
          {enabledKBs.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearKBs}
              className="h-7 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              {tCommon('clear')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="h-7 px-2"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            {isAllSelected ? tCommon('deselectAll') : tCommon('selectAll')}
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {availableKBs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            {t('noKnowledgeBasesAvailable')}
          </div>
        ) : (
          availableKBs.map((kb) => (
            <div
              key={kb.id}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
              onClick={() => toggleKB(kb.id)}
            >
              <Checkbox
                checked={
                  enabledKBs instanceof Set
                    ? enabledKBs.has(kb.id)
                    : (enabledKBs as any[]).includes(kb.id)
                }
                onCheckedChange={() => toggleKB(kb.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <RAGFlowAvatar
                className="size-6"
                avatar={kb.avatar}
                name={kb.name}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{kb.name}</div>
                {!!kb.chunk_num && kb.chunk_num > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {kb.chunk_num} {t('chunks')}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-2 border-t">
        {enabledKBs.size > 0 ? (
          <Badge variant="secondary">
            {enabledKBs.size} {t('knowledgeBasesEnabled')}
          </Badge>
        ) : (
          <Badge variant="outline">{t('noKnowledgeBasesEnabled')}</Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('knowledgeBaseWillBeUsedInNextMessage')}
      </p>
    </div>
  );
}
