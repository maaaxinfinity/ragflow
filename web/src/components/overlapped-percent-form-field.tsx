import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';

export function OverlappedPercentFormField() {
  const { t } = useTranslation();
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name={'parser_config.overlapped_percent'}
      render={({ field }) => {
        if (typeof field.value === 'undefined') {
          // default value set
          form.setValue('parser_config.overlapped_percent', 0);
        }
        return (
          <FormItem className=" items-center space-y-0 ">
            <div className="flex items-center gap-1">
              <FormLabel
                tooltip={t('knowledgeDetails.overlappedPercentTip', 'Percentage of overlapping content between adjacent chunks (0-100%). Higher values improve context continuity but increase storage.')}
                className="text-sm text-muted-foreground whitespace-break-spaces w-1/4"
              >
                {t('knowledgeDetails.overlappedPercent', 'Overlapped Percent')}
              </FormLabel>
              <div className="w-3/4 flex items-center gap-2">
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min={0}
                    max={100}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      field.onChange(isNaN(value) ? 0 : Math.min(100, Math.max(0, value)));
                    }}
                  ></Input>
                </FormControl>
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="flex pt-1">
              <div className="w-1/4"></div>
              <FormMessage />
            </div>
          </FormItem>
        );
      }}
    />
  );
}
