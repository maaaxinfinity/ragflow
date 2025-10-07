import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, Spin } from 'antd';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchModelCards } from '../hooks/use-fetch-model-cards';

interface ModelCardSelectorProps {
  selectedModelCardId?: number;
  onModelCardChange: (modelCardId: number) => void;
}

export function ModelCardSelector({
  selectedModelCardId,
  onModelCardChange,
}: ModelCardSelectorProps) {
  const { t } = useTranslate('chat');
  const { data: modelCards, isLoading, error } = useFetchModelCards();

  const handleChange = (value: number) => {
    localStorage.setItem('free_chat_model_card_id', value.toString());
    onModelCardChange(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>{t('selectModelCard', 'Select Model Card')}</Label>
        <div className="flex items-center justify-center p-4">
          <Spin />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>{t('selectModelCard', 'Select Model Card')}</Label>
        <div className="p-4 border rounded-md border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive">
            {t('failedToLoadModelCards', 'Failed to load model cards')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  if (!modelCards || modelCards.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{t('selectModelCard', 'Select Model Card')}</Label>
        <div className="p-4 border rounded-md">
          <p className="text-sm text-muted-foreground mb-2">
            {t('noModelCardsAvailable', 'No model cards available')}
          </p>
          <Button
            size="sm"
            onClick={() => (window.location.href = 'http://localhost:3001')}
          >
            {t('goToManageModelCards', 'Go to Manage Model Cards')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{t('selectModelCard', 'Select Model Card')}</Label>
      <Select
        style={{ width: '100%' }}
        placeholder={t('selectModelCard', 'Select Model Card')}
        value={selectedModelCardId}
        onChange={handleChange}
        options={modelCards.map((card) => ({
          label: card.name,
          value: card.id,
        }))}
      />
      {selectedModelCardId && modelCards.find(c => c.id === selectedModelCardId) && (
        <div className="p-3 border rounded-md bg-muted/30">
          <p className="text-xs font-medium mb-1">
            {modelCards.find(c => c.id === selectedModelCardId)?.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {modelCards.find(c => c.id === selectedModelCardId)?.description}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t('modelCardProvideConfig', 'Model card provides bot configuration and parameters')}
      </p>
    </div>
  );
}
