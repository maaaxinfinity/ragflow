import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import { useTranslate } from '@/hooks/common-hooks';
import { useKBContext } from '../contexts/kb-context';
import { CheckCheck, X } from 'lucide-react';

export function KnowledgeBaseSelector() {
  const { t } = useTranslate('chat');
  const { t: tCommon } = useTranslate('common');
  const { enabledKBs, availableKBs, loading, toggleKB, toggleAll, clearKBs, isAllSelected } =
    useKBContext();

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{t('knowledgeBases')}</Label>
        <div className="text-sm text-muted-foreground">{tCommon('loading')}</div>
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
                checked={enabledKBs.has(kb.id)}
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
                {kb.chunk_num > 0 && (
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
