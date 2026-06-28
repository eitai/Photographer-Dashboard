import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

import { SettingsIdentityTab } from './settings/SettingsIdentityTab';
import { SettingsHeroTab } from './settings/SettingsHeroTab';
import { SettingsAboutTab } from './settings/SettingsAboutTab';
import { SettingsSectionsTab } from './settings/SettingsSectionsTab';
import { SettingsSystemTab } from './settings/SettingsSystemTab';
import { SettingsSecurityTab } from './settings/SettingsSecurityTab';

type SettingsTab = 'identity' | 'hero' | 'about' | 'sections' | 'system' | 'security';

export const AdminSettings = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'security') return 'security';
    return 'identity';
  });

  // ── SSO linked toast on redirect ─────────────────────────────────────────────
  useEffect(() => {
    const sso = searchParams.get('sso');
    if (sso === 'linked') {
      toast.success(t('admin.settings.sso.linked_success'));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('sso');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  // ── Tab bar ──────────────────────────────────────────────────────────────────
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'identity', label: t('admin.settings.tab.identity') },
    { id: 'hero', label: t('admin.settings.tab.hero') },
    { id: 'about', label: t('admin.settings.tab.about') },
    { id: 'sections', label: t('admin.settings.tab.sections') },
    { id: 'system', label: t('admin.settings.tab.system') },
    { id: 'security', label: t('admin.settings.tab.security') },
  ];

  return (
    <AdminLayout title={t('admin.settings.title')}>
      <div className='flex gap-1 border-b border-beige mb-6 overflow-x-auto pb-px'>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type='button'
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blush ${
              activeTab === id
                ? 'text-charcoal border-b-2 border-blush'
                : 'text-warm-gray hover:text-charcoal hover:bg-ivory'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'identity' && <SettingsIdentityTab />}

      {activeTab === 'hero' && <SettingsHeroTab />}

      {activeTab === 'about' && <SettingsAboutTab />}

      {activeTab === 'sections' && <SettingsSectionsTab />}

      {activeTab === 'system' && <SettingsSystemTab />}

      {activeTab === 'security' && <SettingsSecurityTab />}
    </AdminLayout>
  );
};
