import { useState, useEffect } from 'react';
import { Button } from '@/components/admin/Button';
import { useI18n } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings, queryKeys } from '@/hooks/useQueries';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ThemePicker } from './settingsComponents';

export const SettingsSystemTab = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const setTheme = useAuthStore((s) => s.setTheme);
  const { data: settingsData } = useSettings();

  const [systemTheme, setSystemTheme] = useState('soft');
  const [savingTheme, setSavingTheme] = useState(false);
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [autoSendSms, setAutoSendSms] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Seed from query cache
  useEffect(() => {
    if (!settingsData) return;
    const s = settingsData;
    setSystemTheme((s.theme as string) || 'soft');
    setAutoSendEmail((s.autoSendGalleryEmail as boolean) ?? true);
    setAutoSendSms((s.autoSendGallerySms as boolean) ?? false);
  }, [settingsData]);

  const handleSaveTheme = async () => {
    setSavingTheme(true);
    try {
      await api.put('/settings/landing', { theme: systemTheme });
      setTheme(systemTheme);
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingTheme(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      await api.put('/settings/notifications', { autoSendGalleryEmail: autoSendEmail, autoSendGallerySms: autoSendSms });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingNotifications(false);
    }
  };

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
          <Button type='button' variant='primary' size='sm' onClick={handleSaveTheme} disabled={savingTheme}>
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
          <Button type='button' variant='primary' size='sm' onClick={handleSaveNotifications} disabled={savingNotifications}>
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
