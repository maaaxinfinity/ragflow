import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useDynamicParams } from '../hooks/use-dynamic-params';
import { useTranslate } from '@/hooks/common-hooks';
import { KnowledgeBaseSelector } from './knowledge-base-selector';
import { DialogSelector } from './dialog-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DynamicModelParams } from '../types';

interface ControlPanelProps {
  dialogId: string;
  onDialogChange: (dialogId: string) => void;
  rolePrompt?: string;
  onRolePromptChange?: (prompt: string) => void;
  modelParams?: DynamicModelParams;
  onModelParamsChange?: (params: DynamicModelParams) => void;
}

export function ControlPanel({
  dialogId,
  onDialogChange,
  rolePrompt = '',
  onRolePromptChange,
  modelParams,
  onModelParamsChange,
}: ControlPanelProps) {
  const { params, updateParam, resetParams, paramsChanged } =
    useDynamicParams({
      initialParams: modelParams,
      onParamsChange: onModelParamsChange,
    });
  const { t } = useTranslate('chat');
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
          title={t('resetToDefaults')}
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

      {/* Advanced Parameters - Collapsible */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span>高级参数</span>
            {advancedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {/* Role Prompt */}
          <div className="space-y-2">
            <Label>系统提示词 (Role Prompt)</Label>
            <Textarea
              placeholder="设置AI的角色和行为规范，例如：你是一个专业的技术顾问..."
              value={rolePrompt}
              onChange={(e) => onRolePromptChange?.(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              自定义AI的角色设定，此设置将影响所有对话
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Knowledge Base Selector */}
      <div className="pt-4 border-t">
        <KnowledgeBaseSelector />
      </div>
    </div>
  );
}
