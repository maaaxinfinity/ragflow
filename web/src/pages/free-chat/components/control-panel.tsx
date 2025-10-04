import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw, ChevronDown, ChevronUp, Settings2, Sparkles } from 'lucide-react';
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
    <div className="w-80 border-l flex flex-col h-full bg-gradient-to-b from-background to-muted/20 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">配置面板</h2>
        </div>
        <DialogSelector
          selectedDialogId={dialogId}
          onDialogChange={onDialogChange}
        />
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Model Parameters Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{t('modelParameters')}</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={resetParams}
              title={t('resetToDefaults')}
              className="h-8 w-8"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {paramsChanged && (
            <Alert className="border-primary/50 bg-primary/5">
              <AlertDescription className="text-xs">
                {t('parametersWillTakeEffectInNextMessage')}
              </AlertDescription>
            </Alert>
          )}

          {/* Top P */}
          <div className="space-y-3 p-3 rounded-lg bg-card border">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Top P</Label>
              <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                {params.top_p?.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[params.top_p ?? 0.9]}
              onValueChange={(val) => updateParam('top_p', val[0])}
              className="py-1"
            />
            <p className="text-xs text-muted-foreground">{t('topPTip')}</p>
          </div>

          {/* Temperature */}
          <div className="space-y-3 p-3 rounded-lg bg-card border">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Temperature</Label>
              <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                {params.temperature?.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[params.temperature ?? 0.7]}
              onValueChange={(val) => updateParam('temperature', val[0])}
              className="py-1"
            />
            <p className="text-xs text-muted-foreground">
              {t('temperatureTip')}
            </p>
          </div>

          {/* Advanced Parameters - Collapsible */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between hover:bg-accent"
                size="sm"
              >
                <span className="text-sm font-medium">高级参数</span>
                {advancedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {/* Role Prompt */}
              <div className="space-y-2 p-3 rounded-lg bg-card border">
                <Label className="text-sm font-medium">系统提示词 (Role Prompt)</Label>
                <Textarea
                  placeholder="设置AI的角色和行为规范，例如：你是一个专业的技术顾问..."
                  value={rolePrompt}
                  onChange={(e) => onRolePromptChange?.(e.target.value)}
                  rows={6}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  自定义AI的角色设定，此设置将影响所有对话
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Knowledge Base Selector */}
        <div className="pt-4 border-t">
          <KnowledgeBaseSelector />
        </div>
      </div>
    </div>
  );
}
