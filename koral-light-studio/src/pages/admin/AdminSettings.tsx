import { useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const THEMES = ['soft', 'luxury', 'bold', 'minimal', 'warm', 'ocean', 'forest', 'rose', 'vintage', 'midnight', 'bw'] as const;
const THEME_META: Record<string, { bg: string; primary: string; fg: string }> = {
  soft: { bg: '#faf8f4', primary: '#e7b8b5', fg: '#3c3a38' },
  luxury: { bg: '#1a1814', primary: '#c9a84c', fg: '#f0ead8' },
  bold: { bg: '#111111', primary: '#c0392b', fg: '#f5f5f5' },
  minimal: { bg: '#ffffff', primary: '#111111', fg: '#111111' },
  warm: { bg: '#f5ede3', primary: '#c4612a', fg: '#3b2a1a' },
  ocean: { bg: '#eef4f7', primary: '#2d7d9a', fg: '#1a3040' },
  forest: { bg: '#f0f4ef', primary: '#3a7d44', fg: '#1e2d1f' },
  rose: { bg: '#fdf4f5', primary: '#c4687a', fg: '#3d2023' },
  vintage: { bg: '#f7f0e6', primary: '#8b6914', fg: '#2c2416' },
  midnight: { bg: '#0f1624', primary: '#5b8dee', fg: '#e8edf5' },
  bw: { bg: '#ffffff', primary: '#000000', fg: '#000000' },
};

interface ThemePickerProps {
  value: string;
  onChange: (key: string) => void;
  themes: readonly string[];
  meta: Record<string, { bg: string; primary: string; fg: string }>;
  label: string;
  getLabel: (key: string) => string;
}

const ThemePicker = ({ value, onChange, themes, meta, label, getLabel }: ThemePickerProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = meta[value];

  return (
    <div>
      <label className='block text-xs text-warm-gray mb-2'>{label}</label>
      <div ref={ref} className='relative'>
        <button
          type='button'
          onClick={() => setOpen((o) => !o)}
          className='w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-beige text-charcoal text-sm hover:border-blush/50 transition-colors'
        >
          <div
            className='w-5 h-5 rounded-full border border-black/10 flex-shrink-0'
            style={{ background: `linear-gradient(135deg, ${current?.bg} 50%, ${current?.primary} 50%)` }}
          />
          <span className='flex-1 text-left'>{getLabel(value)}</span>
          <svg width='12' height='12' viewBox='0 0 12 12' fill='currentColor' className='text-warm-gray'>
            <path d='M2 4l4 4 4-4' stroke='currentColor' strokeWidth='1.5' fill='none' strokeLinecap='round'/>
          </svg>
        </button>

        {open && (
          <div className='absolute z-50 mt-1 w-full bg-card border border-beige rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto'>
            {themes.map((key) => {
              const m = meta[key];
              const isSelected = value === key;
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => { onChange(key); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-ivory transition-colors ${isSelected ? 'text-charcoal font-medium' : 'text-warm-gray'}`}
                >
                  <div
                    className='w-5 h-5 rounded-full border border-black/10 flex-shrink-0'
                    style={{ background: `linear-gradient(135deg, ${m.bg} 50%, ${m.primary} 50%)` }}
                  />
                  {getLabel(key)}
                  {isSelected && <span className='ml-auto text-blush'>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminSettings = () => {
  const { admin } = useAuth();
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const setTheme = useAuthStore((s) => s.setTheme);
  const { t } = useI18n();
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: admin?.name ?? '',
    studioName: admin?.studioName ?? '',
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Landing page state
  const [landing, setLanding] = useState({
    bio: '',
    phone: '',
    instagramHandle: '',
    facebookUrl: '',
    heroSubtitle: '',
    contactEmail: '',
    theme: 'bw',
  });
  const [landingMsg, setLandingMsg] = useState('');
  const [savingLanding, setSavingLanding] = useState(false);
  const [heroPreview, setHeroPreview] = useState('');
  const [profilePreview, setProfilePreview] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get('/settings')
      .then((r) => {
        setLanding({
          bio: r.data.bio || '',
          phone: r.data.phone || '',
          instagramHandle: r.data.instagramHandle || '',
          facebookUrl: r.data.facebookUrl || '',
          heroSubtitle: r.data.heroSubtitle || '',
          contactEmail: r.data.contactEmail || '',
          theme: r.data.theme || 'bw',
        });
        setTheme(r.data.theme || 'bw');
        if (r.data.heroImagePath) setHeroPreview(`${API_BASE}${r.data.heroImagePath}`);
        if (r.data.profileImagePath) setProfilePreview(`${API_BASE}${r.data.profileImagePath}`);
      })
      .catch(() => toast.error(t('admin.settings.load_failed')));
  }, []);

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.patch('/auth/profile', {
        name: profile.name || undefined,
        studioName: profile.studioName || undefined,
      });
      setAdmin(res.data);
      setProfileMsg(t('admin.settings.profile_saved'));
    } catch {
      setProfileMsg(t('admin.settings.profile_failed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.next !== password.confirm) {
      setMsg(t('admin.settings.passwords_mismatch'));
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/password', { current: password.current, next: password.next });
      setMsg(t('admin.settings.password_updated'));
      setPassword({ current: '', next: '', confirm: '' });
    } catch {
      setMsg(t('admin.settings.password_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleLanding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLanding(true);
    try {
      await api.put('/settings/landing', landing);
      setLandingMsg(t('admin.settings.landing_saved'));
    } catch {
      setLandingMsg(t('admin.settings.landing_failed'));
    } finally {
      setSavingLanding(false);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/settings/hero-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setHeroPreview(`${API_BASE}${res.data.heroImagePath}`);
    } catch {
      toast.error(t('admin.settings.hero_upload_failed'));
    } finally {
      setUploadingHero(false);
    }
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProfile(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/settings/profile-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfilePreview(`${API_BASE}${res.data.profileImagePath}`);
    } catch {
      toast.error(t('admin.settings.profile_upload_failed'));
    } finally {
      setUploadingProfile(false);
    }
  };

  return (
    <AdminLayout title={t('admin.settings.title')}>
      <div className='flex flex-col lg:flex-row gap-6 items-start'>
        {/* ── Left column: account, profile, password, system ── */}
        <div className='flex flex-col gap-6 w-full lg:w-80 shrink-0'>
          {/* Account info */}
          <div className='bg-card rounded-xl border border-beige p-6'>
            <h2 className=' text-charcoal mb-4'>{t('admin.settings.account')}</h2>
            <dl className='space-y-3 text-sm'>
              <div>
                <dt className='text-xs text-warm-gray'>{t('admin.common.name')}</dt>
                <dd className='text-charcoal'>{admin?.name}</dd>
              </div>
              <div>
                <dt className='text-xs text-warm-gray'>{t('admin.common.email')}</dt>
                <dd className='text-charcoal'>{admin?.email}</dd>
              </div>
            </dl>
          </div>

          {/* Studio Profile */}
          <div className='bg-card rounded-xl border border-beige p-6'>
            <h2 className=' text-charcoal mb-4'>{t('admin.settings.studio_profile')}</h2>
            <form onSubmit={handleProfile} className='space-y-4'>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.display_name')}</label>
                <input
                  type='text'
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.studio_name')}</label>
                <input
                  type='text'
                  value={profile.studioName}
                  onChange={(e) => setProfile({ ...profile, studioName: e.target.value })}
                  className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                />
              </div>
              {profileMsg && <p className='text-sm text-charcoal'>{profileMsg}</p>}
              <button
                type='submit'
                disabled={savingProfile}
                className='bg-blush text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
              >
                {savingProfile ? t('admin.common.saving') : t('admin.settings.save_profile')}
              </button>
            </form>
          </div>

          {/* Change password */}
          <div className='bg-card rounded-xl border border-beige p-6'>
            <h2 className=' text-charcoal mb-4'>{t('admin.settings.change_password')}</h2>
            <form onSubmit={handlePassword} className='space-y-4'>
              {[
                { field: 'current', label: t('admin.settings.current_password') },
                { field: 'next', label: t('admin.settings.new_password') },
                { field: 'confirm', label: t('admin.settings.confirm_password') },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className='block text-xs text-warm-gray mb-1'>{label}</label>
                  <input
                    type='password'
                    value={(password as any)[field]}
                    onChange={(e) => setPassword({ ...password, [field]: e.target.value })}
                    required
                    className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                  />
                </div>
              ))}
              {msg && <p className='text-sm text-charcoal'>{msg}</p>}
              <button
                type='submit'
                disabled={saving}
                className='bg-blush text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
              >
                {saving ? t('admin.settings.updating') : t('admin.settings.update_password')}
              </button>
            </form>
          </div>

          {/* Public page URL */}
          {admin?.id && (
            <div className='bg-card rounded-xl border border-beige p-6'>
              <h2 className=' text-charcoal mb-4'>{t('admin.settings.public_page_title')}</h2>
              <p className='text-xs text-warm-gray mb-2'>{t('admin.settings.public_page_label')}</p>
              <a href={`/${admin.id}`} target='_blank' rel='noreferrer' className='text-sm text-blush underline font-mono break-all'>
                {window.location.origin}/{admin.id}
              </a>
            </div>
          )}

          {/* System info */}
          <div className='bg-card rounded-xl border border-beige p-6'>
            <h2 className=' text-charcoal mb-4'>{t('admin.settings.system')}</h2>
            <dl className='space-y-2 text-sm'>
              <div>
                <dt className='text-xs text-warm-gray'>{t('admin.settings.api_server')}</dt>
                <dd className='text-charcoal font-mono text-xs'>{import.meta.env.VITE_API_URL || 'http://localhost:5000'}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ── Right column: landing page customization ── */}
        <div className='flex-1 min-w-0'>
          <div className='bg-card rounded-xl border border-beige p-6 space-y-6'>
            <h2 className=' text-charcoal'>{t('admin.settings.landing_title')}</h2>

            {/* Theme picker */}
            <ThemePicker
              value={landing.theme}
              onChange={(key) => { setLanding({ ...landing, theme: key }); setTheme(key); }}
              themes={THEMES}
              meta={THEME_META}
              label={t('admin.settings.theme_label')}
              getLabel={(key) => t(`theme.${key}`)}
            />

            {/* Images row */}
            <div className='flex flex-col sm:flex-row gap-6'>
              {/* Hero image */}
              <div className='flex-1'>
                <label className='block text-xs text-warm-gray mb-2'>{t('admin.settings.hero_image')}</label>
                {heroPreview && (
                  <div className='mb-2 rounded-lg overflow-hidden h-32 bg-beige'>
                    <img src={heroPreview} alt='Hero preview' className='w-full h-full object-cover' />
                  </div>
                )}
                <input ref={heroInputRef} type='file' accept='image/*' className='hidden' onChange={handleHeroUpload} />
                <button
                  type='button'
                  onClick={() => heroInputRef.current?.click()}
                  disabled={uploadingHero}
                  className='px-4 py-2 border border-beige rounded-lg text-xs text-warm-gray hover:border-blush hover:text-blush transition-colors disabled:opacity-60'
                >
                  {uploadingHero
                    ? t('admin.common.uploading')
                    : heroPreview
                      ? t('admin.settings.hero_image_replace')
                      : t('admin.settings.hero_image_upload')}
                </button>
              </div>

              {/* Profile photo */}
              <div>
                <label className='block text-xs text-warm-gray mb-2'>{t('admin.settings.profile_image')}</label>
                {profilePreview && (
                  <div className='mb-2 w-24 h-24 rounded-full overflow-hidden bg-beige'>
                    <img src={profilePreview} alt='Profile preview' className='w-full h-full object-cover' />
                  </div>
                )}
                <input ref={profileInputRef} type='file' accept='image/*' className='hidden' onChange={handleProfileUpload} />
                <button
                  type='button'
                  onClick={() => profileInputRef.current?.click()}
                  disabled={uploadingProfile}
                  className='px-4 py-2 border border-beige rounded-lg text-xs text-warm-gray hover:border-blush hover:text-blush transition-colors disabled:opacity-60'
                >
                  {uploadingProfile
                    ? t('admin.common.uploading')
                    : profilePreview
                      ? t('admin.settings.profile_image_replace')
                      : t('admin.settings.profile_image_upload')}
                </button>
              </div>
            </div>

            {/* Text fields */}
            <form onSubmit={handleLanding} className='space-y-4'>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.hero_subtitle')}</label>
                <input
                  type='text'
                  value={landing.heroSubtitle}
                  onChange={(e) => setLanding({ ...landing, heroSubtitle: e.target.value })}
                  placeholder='צילומי משפחה, הריון וניו בורן בצפון הארץ'
                  className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.bio')}</label>
                <textarea
                  rows={4}
                  value={landing.bio}
                  onChange={(e) => setLanding({ ...landing, bio: e.target.value })}
                  placeholder={t('admin.settings.bio_placeholder')}
                  className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 resize-none'
                />
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.phone')}</label>
                  <input
                    type='text'
                    value={landing.phone}
                    onChange={(e) => setLanding({ ...landing, phone: e.target.value })}
                    placeholder='050-0000000'
                    className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                  />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.contact_email')}</label>
                  <input
                    type='email'
                    value={landing.contactEmail}
                    onChange={(e) => setLanding({ ...landing, contactEmail: e.target.value })}
                    placeholder='studio@example.com'
                    className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                  />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.instagram')}</label>
                  <input
                    type='text'
                    value={landing.instagramHandle}
                    onChange={(e) => setLanding({ ...landing, instagramHandle: e.target.value })}
                    placeholder='@username'
                    className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                  />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.facebook')}</label>
                  <input
                    type='text'
                    value={landing.facebookUrl}
                    onChange={(e) => setLanding({ ...landing, facebookUrl: e.target.value })}
                    placeholder='https://facebook.com/yourpage'
                    className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                  />
                </div>
              </div>
              {landingMsg && <p className='text-sm text-charcoal'>{landingMsg}</p>}
              <button
                type='submit'
                disabled={savingLanding}
                className='bg-blush text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
              >
                {savingLanding ? t('admin.common.saving') : t('admin.settings.save_landing')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
