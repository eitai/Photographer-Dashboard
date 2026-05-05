import { useI18n } from '@/lib/i18n';

interface WizardStepIndicatorProps {
  step: 1 | 2;
}

export const WizardStepIndicator = ({ step }: WizardStepIndicatorProps) => {
  const { t } = useI18n();

  return (
    <div className='flex items-center gap-2'>
      <span className='text-xs text-warm-gray'>
        {t('admin.clients.wizard.step_indicator').replace('{step}', String(step)).replace('{total}', '2')}
      </span>
      <div className='flex items-center gap-1'>
        {([1, 2] as const).map((n) => (
          <span
            key={n}
            className={`w-2 h-2 rounded-full transition-colors ${
              n <= step ? 'bg-blush' : 'border border-beige bg-transparent'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
