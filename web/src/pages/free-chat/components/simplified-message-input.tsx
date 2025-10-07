import { Button } from '@/components/ui/button';
import { MessageSquarePlus, Trash2, Paperclip, ArrowUp } from 'lucide-react';
import { useTranslate } from '@/hooks/common-hooks';
import { useCallback, useRef } from 'react';

interface SimplifiedMessageInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onNewTopic: () => void;
  onClearMessages: () => void;
  onFileUpload?: (file: File) => void;
  disabled?: boolean;
  sendLoading?: boolean;
}

export function SimplifiedMessageInput({
  value,
  onChange,
  onSend,
  onNewTopic,
  onClearMessages,
  onFileUpload,
  disabled = false,
  sendLoading = false,
}: SimplifiedMessageInputProps) {
  const { t } = useTranslate('chat');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !sendLoading && value.trim()) {
        onSend();
        // Reset height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  }, [disabled, sendLoading, value, onSend]);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="flex-shrink-0 p-3 max-w-4xl w-full mx-auto">
      {/* Input Container */}
      <div className="relative flex items-end bg-muted/50 border rounded-lg p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={t('inputPlaceholder', '输入您的问题...')}
          className="flex-1 bg-transparent border-none outline-none resize-none min-h-[24px] max-h-[200px] text-sm pr-12"
          rows={1}
        />
        <Button
          onClick={onSend}
          disabled={disabled || sendLoading || !value.trim()}
          size="icon"
          className="absolute right-2 bottom-2 h-8 w-8 rounded-full"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mt-2 px-1">
        {/* Left: Action Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewTopic}
            disabled={disabled}
            className="h-8 gap-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="text-xs">{t('newTopic', '新话题')}</span>
          </Button>

          {onFileUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFileClick}
                disabled={disabled}
                className="h-8 gap-2"
              >
                <Paperclip className="h-4 w-4" />
                <span className="text-xs">{t('upload', '上传')}</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearMessages}
            disabled={disabled}
            className="h-8 gap-2 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-xs">{t('clearMessages', '清空消息')}</span>
          </Button>
        </div>

        {/* Right: Helper Text */}
        <div className="text-xs text-muted-foreground">
          {t('enterToSend', 'Enter发送，Shift+Enter换行')}
        </div>
      </div>
    </div>
  );
}
