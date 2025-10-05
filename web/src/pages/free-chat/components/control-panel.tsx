import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw, ChevronDown, ChevronUp, Settings2, Sparkles, Save, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDynamicParams } from '../hooks/use-dynamic-params';
import { useTranslate } from '@/hooks/common-hooks';
import { KnowledgeBaseSelector } from './knowledge-base-selector';
import { DialogSelector } from './dialog-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DynamicModelParams } from '../types';

interface ControlPanelProps {
  dialogId: string;
  onDialogChange: (dialogId: string) => void;
  rolePrompt?: string;
  onRolePromptChange?: (prompt: string) => void;
  modelParams?: DynamicModelParams;
  onModelParamsChange?: (params: DynamicModelParams) => void;
  // Save button props
  saving?: boolean;
  hasUnsavedChanges?: boolean;
  onManualSave?: () => void;
  // User info props
  userId?: string;
  currentUserInfo?: any;
  userInfo?: any;
  tenantInfo?: any;
}

export function ControlPanel({
  dialogId,
  onDialogChange,
  rolePrompt = '',
  onRolePromptChange,
  modelParams,
  onModelParamsChange,
  saving = false,
  hasUnsavedChanges = false,
  onManualSave,
  userId,
  currentUserInfo,
  userInfo,
  tenantInfo,
}: ControlPanelProps) {
  const { params, updateParam, resetParams, paramsChanged } =
    useDynamicParams({
      initialParams: modelParams,
      onParamsChange: onModelParamsChange,
    });
  const { t } = useTranslate('chat');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false);
  const [tempPrompt, setTempPrompt] = useState(rolePrompt);

  // Sync rolePrompt to tempPrompt when it changes
  useEffect(() => {
    setTempPrompt(rolePrompt);
  }, [rolePrompt]);

  // Debug: Log user info received in ControlPanel
  useEffect(() => {
    console.log('[ControlPanel] Props received:', {
      userId,
      userInfo,
      currentUserInfo,
      tenantInfo,
      hasUserInfo: !!userInfo,
      hasCurrentUserInfo: !!currentUserInfo,
      userInfoNickname: userInfo?.nickname,
      userInfoEmail: userInfo?.email,
      currentUserInfoNickname: currentUserInfo?.nickname,
      currentUserInfoEmail: currentUserInfo?.email,
    });
  }, [userId, userInfo, currentUserInfo, tenantInfo]);

  return (
    <div className="w-80 border-l flex flex-col h-full bg-gradient-to-b from-background to-muted/20 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">配置面板</h2>
          </div>
          {/* Save Button */}
          {onManualSave && (
            <Button
              onClick={onManualSave}
              disabled={saving || !hasUnsavedChanges}
              size="sm"
              variant={hasUnsavedChanges ? "default" : "outline"}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {hasUnsavedChanges ? '保存' : '已保存'}
                </>
              )}
            </Button>
          )}
        </div>
        {hasUnsavedChanges && !saving && (
          <Alert className="py-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
              有未保存的更改 · 30秒后自动保存
            </AlertDescription>
          </Alert>
        )}
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
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">系统提示词 (Role Prompt)</Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setTempPrompt(rolePrompt);
                      setFullscreenPrompt(true);
                    }}
                    className="h-6 w-6"
                    title="全屏编辑"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  placeholder="设置AI的角色和行为规范，例如：你是一个专业的技术顾问..."
                  defaultValue={rolePrompt}
                  onBlur={(e) => onRolePromptChange?.(e.target.value)}
                  rows={6}
                  className="resize-none text-sm overflow-y-auto"
                />
                <p className="text-xs text-muted-foreground">
                  自定义AI的角色设定，失焦时自动保存
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Knowledge Base Selector */}
        <div className="pt-4 border-t">
          <KnowledgeBaseSelector />
        </div>

        {/* User Info Display */}
        {userId && (currentUserInfo || userInfo) && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-3 bg-card/95 backdrop-blur-md border-2 border-primary/20 rounded-xl px-4 py-2.5 shadow-lg hover:shadow-xl transition-all duration-200">
              <RAGFlowAvatar
                name={(userInfo?.nickname || userInfo?.email) || (currentUserInfo?.nickname || currentUserInfo?.email) || 'User'}
                avatar={userInfo?.avatar || currentUserInfo?.avatar}
                isPerson={true}
                className="w-9 h-9 ring-2 ring-primary/20"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold flex items-center gap-2">
                  {(userInfo?.nickname || userInfo?.email) || (currentUserInfo?.nickname || currentUserInfo?.email) || 'User'}
                  {userInfo?.is_su && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                      SU
                    </span>
                  )}
                </span>
                {((userInfo?.nickname && userInfo?.email) || (currentUserInfo?.nickname && currentUserInfo?.email)) && (
                  <span className="text-xs text-muted-foreground">
                    {userInfo?.email || currentUserInfo?.email}
                  </span>
                )}
                {tenantInfo?.name && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    团队：{tenantInfo.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Role Prompt Dialog */}
      <Dialog open={fullscreenPrompt} onOpenChange={setFullscreenPrompt}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              系统提示词 (Role Prompt)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <Textarea
              value={tempPrompt}
              onChange={(e) => setTempPrompt(e.target.value)}
              placeholder="设置AI的角色和行为规范，例如：你是一个专业的技术顾问..."
              className="h-full resize-none text-sm overflow-y-auto"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setFullscreenPrompt(false)}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                onRolePromptChange?.(tempPrompt);
                setFullscreenPrompt(false);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
