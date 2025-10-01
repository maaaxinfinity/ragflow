import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RotateCcw } from 'lucide-react';
import { useDynamicParams } from '../hooks/use-dynamic-params';
import { useTranslate } from '@/hooks/common-hooks';
import { KnowledgeBaseSelector } from './knowledge-base-selector';
import { DialogSelector } from './dialog-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ControlPanelProps {
  dialogId: string;
  onDialogChange: (dialogId: string) => void;
}

export function ControlPanel({ dialogId, onDialogChange }: ControlPanelProps) {
  const { params, updateParam, resetParams, paramsChanged } =
    useDynamicParams();
  const { t } = useTranslate('chat');

  return (
    <div className="w-80 border-l p-6 space-y-6 overflow-y-auto">
      {/* Dialog Selector */}
      <div className="pb-4 border-b">
        <DialogSelector
          selectedDialogId={dialogId}
          onDialogChange={onDialogChange}
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('modelParameters')}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={resetParams}
          title="Reset to defaults"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {paramsChanged && (
        <Alert>
          <AlertDescription>
            {t('parametersWillTakeEffectInNextMessage')}
          </AlertDescription>
        </Alert>
      )}

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Temperature</Label>
          <span className="text-sm text-muted-foreground">
            {params.temperature?.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[params.temperature ?? 0.7]}
          onValueChange={(val) => updateParam('temperature', val[0])}
        />
        <p className="text-xs text-muted-foreground">
          {t('temperatureTip')}
        </p>
      </div>

      {/* Top P */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Top P</Label>
          <span className="text-sm text-muted-foreground">
            {params.top_p?.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[params.top_p ?? 0.9]}
          onValueChange={(val) => updateParam('top_p', val[0])}
        />
        <p className="text-xs text-muted-foreground">{t('topPTip')}</p>
      </div>

      {/* Frequency Penalty */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Frequency Penalty</Label>
          <span className="text-sm text-muted-foreground">
            {params.frequency_penalty?.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[params.frequency_penalty ?? 0]}
          onValueChange={(val) => updateParam('frequency_penalty', val[0])}
        />
        <p className="text-xs text-muted-foreground">
          {t('frequencyPenaltyTip')}
        </p>
      </div>

      {/* Presence Penalty */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Presence Penalty</Label>
          <span className="text-sm text-muted-foreground">
            {params.presence_penalty?.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[params.presence_penalty ?? 0]}
          onValueChange={(val) => updateParam('presence_penalty', val[0])}
        />
        <p className="text-xs text-muted-foreground">
          {t('presencePenaltyTip')}
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Max Tokens</Label>
          <span className="text-sm text-muted-foreground">
            {params.max_tokens}
          </span>
        </div>
        <Slider
          min={100}
          max={8000}
          step={100}
          value={[params.max_tokens ?? 2000]}
          onValueChange={(val) => updateParam('max_tokens', val[0])}
        />
        <p className="text-xs text-muted-foreground">
          {t('maxTokensTip')}
        </p>
      </div>

      {/* Knowledge Base Selector */}
      <div className="pt-4 border-t">
        <KnowledgeBaseSelector />
      </div>
    </div>
  );
}
