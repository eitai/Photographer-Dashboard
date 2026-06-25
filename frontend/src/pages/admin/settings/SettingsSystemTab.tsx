import { Button } from '@/components/admin/Button';
import { useI18n } from '@/lib/i18n';
import { ThemePicker } from './settingsComponents';

interface SettingsSystemTabProps {
  systemTheme: string;
  setSystemTheme: React.Dispatch<React.SetStateAction<string>>;
  savingTheme: boolean;
  onSaveTheme: () => void;
  autoSendEmail: boolean;
  setAutoSendEmail: React.Dispatch<React.SetStateAction<boolean>>;
  autoSendSms: boolean;
  setAutoSendSms: React.Dispatch<React.SetStateAction<boolean>>;
  savingNotifications: boolean;
  onSaveNotifications: () => void;
}

export const SettingsSystemTab = ({
  systemTheme,
  setSystemTheme,
  savingTheme,
  onSaveTheme,
  autoSendEmail,
  setAutoSendEmail,
  autoSendSms,
  setAutoSendSms,
  savingNotifications,
  onSaveNotifications,
}: SettingsSystemTabProps) => {
  const { t } = useI18n();

  return (
    <div className='max-w-md space-y-4'>
      <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
        <h2 className='font-semibold text-charcoal'>{t('admin.settings.theme_label')}</h2>
        <ThemePicker
          value={systemTheme}
          onChange={setSystemTheme}
          label={t('admin.settings.theme_label')}
          getLabel={(key) => t(`theme.${key}`)}
        />
        <div className='pt-2 border-t border-beige'>
          <Button type='button' variant='primary' size='sm' onClick={onSaveTheme} disabled={savingTheme}>
            {savingTheme ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </div>
      </div>

      <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
        <h2 className='font-semibold text-charcoal'>{t('admin.settings.notifications')}</h2>
        <label className='flex items-start gap-3 cursor-pointer'>
          <input
            type='checkbox'
            checked={autoSendEmail}
            onChange={(e) => setAutoSendEmail(e.target.checked)}
            className='mt-0.5 h-4 w-4 rounded border-beige accent-blush cursor-pointer'
          />
          <div>
            <span className='text-sm text-charcoal'>{t('admin.settings.auto_send_email')}</span>
            <p className='text-xs text-warm-gray mt-0.5'>{t('admin.settings.auto_send_email_desc')}</p>
          </div>
        </label>
        <label className='flex items-start gap-3 cursor-pointer'>
          <input
            type='checkbox'
            checked={autoSendSms}
            onChange={(e) => setAutoSendSms(e.target.checked)}
            className='mt-0.5 h-4 w-4 rounded border-beige accent-blush cursor-pointer'
          />
          <div>
            <span className='text-sm text-charcoal'>{t('admin.settings.auto_send_sms')}</span>
            <p className='text-xs text-warm-gray mt-0.5'>{t('admin.settings.auto_send_sms_desc')}</p>
          </div>
        </label>
        <div className='pt-2 border-t border-beige'>
          <Button type='button' variant='primary' size='sm' onClick={onSaveNotifications} disabled={savingNotifications}>
            {savingNotifications ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </div>
      </div>

      <div className='bg-card rounded-xl border border-beige p-6'>
        <h2 className='font-semibold text-charcoal mb-4'>{t('admin.settings.system')}</h2>
        <dl className='space-y-2 text-sm'>
          <div>
            <dt className='text-xs text-warm-gray'>{t('admin.settings.api_server')}</dt>
            <dd className='text-charcoal font-mono text-xs'>{import.meta.env.VITE_API_URL || 'http://localhost:5000'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
