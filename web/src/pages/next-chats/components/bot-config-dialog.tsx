import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { DatasetMetadata } from '@/constants/chat';
import { IDialog } from '@/interfaces/database/chat';
import { useSetDialog } from '@/hooks/use-chat-request';
import {
  removeUselessFieldsFromValues,
  setLLMSettingEnabledValues,
} from '@/utils/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { omit } from 'lodash';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ChatBasicSetting from '../chat/app-settings/chat-basic-settings';
import { ChatModelSettings } from '../chat/app-settings/chat-model-settings';
import { ChatPromptEngine } from '../chat/app-settings/chat-prompt-engine';
import { SavingButton } from '../chat/app-settings/saving-button';
import { useChatSettingSchema } from '../chat/app-settings/use-chat-setting-schema';

interface BotConfigDialogProps {
  visible: boolean;
  onClose: () => void;
  bot: IDialog | null;
  onSuccess?: () => void;
}

export function BotConfigDialog({
  visible,
  onClose,
  bot,
  onSuccess,
}: BotConfigDialogProps) {
  const formSchema = useChatSettingSchema();
  const { setDialog, loading } = useSetDialog();
  const { t } = useTranslation();

  type FormSchemaType = z.infer<typeof formSchema>;

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    shouldUnregister: true,
    defaultValues: {
      name: '',
      icon: '',
      description: '',
      kb_ids: [],
      prompt_config: {
        quote: true,
        keyword: false,
        tts: false,
        use_kg: false,
        refine_multiturn: true,
        system: '',
        parameters: [],
        reasoning: false,
        cross_languages: [],
      },
      top_n: 8,
      similarity_threshold: 0.2,
      vector_similarity_weight: 0.2,
      top_k: 1024,
      meta_data_filter: {
        method: DatasetMetadata.Disabled,
        manual: [],
      },
    },
  });

  async function onSubmit(values: FormSchemaType) {
    const nextValues: Record<string, any> = removeUselessFieldsFromValues(
      values,
      'llm_setting.',
    );

    const code = await setDialog({
      ...omit(bot, 'operator_permission'),
      ...nextValues,
      dialog_id: bot?.id,
    });

    if (code === 0) {
      onClose();
      onSuccess?.();
    }
  }

  function onInvalid(errors: any) {
    console.log('Form validation failed:', errors);
  }

  useEffect(() => {
    if (bot) {
      const llmSettingEnabledValues = setLLMSettingEnabledValues(
        bot.llm_setting,
      );

      const nextData = {
        ...bot,
        ...llmSettingEnabledValues,
      };
      form.reset(nextData as FormSchemaType);
    }
  }, [bot, form]);

  return (
    <Dialog open={visible} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('chat.editBot')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            className="flex-1 flex flex-col min-h-0"
          >
            <section className="space-y-6 overflow-auto flex-1 pr-4 min-h-0">
              <ChatBasicSetting></ChatBasicSetting>
              <Separator />
              <ChatPromptEngine></ChatPromptEngine>
              <Separator />
              <ChatModelSettings></ChatModelSettings>
            </section>
            <div className="space-x-5 text-right pt-4 border-t mt-4">
              <Button variant={'outline'} onClick={onClose} type="button">
                {t('chat.cancel')}
              </Button>
              <SavingButton loading={loading}></SavingButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
