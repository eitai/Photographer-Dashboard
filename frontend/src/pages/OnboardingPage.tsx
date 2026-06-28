import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/lib/i18n';

const BLUSH = '#E7B8B5';
const GRADIENT = `linear-gradient(135deg, ${BLUSH}, #c89fd4, #8B5CF6)`;
const LS_STEP_KEY = 'koral_onboarding_step';

type Theme = 'soft' | 'bw';

const THEMES: { id: Theme; labelKey: string; descKey: string; bg: string; accent: string }[] = [
  { id: 'soft', labelKey: 'onboarding.theme.soft_label', descKey: 'onboarding.theme.soft_desc', bg: '#faf8f4', accent: '#e7b8b5' },
  { id: 'bw', labelKey: 'onboarding.theme.bw_label', descKey: 'onboarding.theme.bw_desc', bg: '#ffffff', accent: '#000000' },
];

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className='flex items-center justify-center gap-2 mb-8'>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className='rounded-full transition-all duration-300'
          style={{
            width: i + 1 === current ? 24 : 8,
            height: 8,
            background: i + 1 <= current ? BLUSH : '#e5e7eb',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { admin, setAdmin } = useAuthStore();
  const { t } = useI18n();

  const paymentSuccess = searchParams.get('payment_success') === '1';
  const upgradePending = searchParams.get('upgrade_pending') === '1';

  const savedStep = Number(localStorage.getItem(LS_STEP_KEY)) || 1;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(savedStep as 1 | 2 | 3 | 4);

  // Step 1 fields
  const [name, setName] = useState(admin?.name || '');
  const [studioName, setStudioName] = useState(admin?.studioName || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Step 2 fields
  const [selectedTheme, setSelectedTheme] = useState<Theme>('soft');
  const [savingTheme, setSavingTheme] = useState(false);
  const [savedTheme, setSavedTheme] = useState(false);

  // Gate: if onboarding already completed, redirect
  useEffect(() => {
    if (admin && admin.firstLogin === false) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [admin, navigate]);

  function persistStep(s: 1 | 2 | 3 | 4) {
    setStep(s);
    localStorage.setItem(LS_STEP_KEY, String(s));
  }

  async function completeOnboarding() {
    try {
      await api.patch('/auth/first-login');
    } catch {
      // best-effort
    }
    if (admin) {
      const updated = { ...admin, firstLogin: false };
      setAdmin(updated);
      localStorage.setItem('koral_admin_user', JSON.stringify(updated));
    }
    localStorage.removeItem(LS_STEP_KEY);
    navigate('/admin/dashboard');
  }

  // ── Step 1 handlers ──────────────────────────────────────────────────────
  async function handleProfileNext() {
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/auth/profile', { name: name.trim(), studioName: studioName.trim() || undefined });
      if (data.admin) {
        setAdmin(data.admin);
        localStorage.setItem('koral_admin_user', JSON.stringify(data.admin));
      }
    } catch {
      // non-fatal
    } finally {
      setSavingProfile(false);
    }
    persistStep(2);
  }

  function handleProfileSkip() {
    persistStep(2);
  }

  // ── Step 2 handlers ──────────────────────────────────────────────────────
  async function handleThemeClick(theme: Theme) {
    setSelectedTheme(theme);
    setSavingTheme(true);
    setSavedTheme(false);
    try {
      await api.put('/settings/landing', { theme });
      setSavedTheme(true);
    } catch {
      // non-fatal
    } finally {
      setSavingTheme(false);
    }
  }

  function handleThemeNext() {
    persistStep(3);
  }

  function handleThemeSkip() {
    persistStep(3);
  }

  // ── Step 3 handlers ──────────────────────────────────────────────────────
  const publicUrl = `${window.location.origin}/${admin?.username || admin?.id}`;

  function openPublicPage() {
    window.open(publicUrl, '_blank');
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(publicUrl)}`, '_blank');
  }

  function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, '_blank');
  }

  function shareSms() {
    window.open(`sms:?body=${encodeURIComponent(publicUrl)}`, '_blank');
  }

  function shareEmail() {
    window.open(`mailto:?subject=${encodeURIComponent('הגלריה שלי')}&body=${encodeURIComponent(publicUrl)}`, '_blank');
  }

  const [copied, setCopied] = useState(false);
  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const pageTitleKey = step === 1 ? 'onboarding.step1.title' : step === 2 ? 'onboarding.step2.title' : step === 3 ? 'onboarding.step3.title' : 'onboarding.step4.title';

  async function goTo(path: string) {
    await completeOnboarding();
    navigate(path);
  }

  return (
    <div data-theme="bw" className='min-h-screen flex flex-col items-center justify-center px-4 py-12' style={{ background: '#FAF8F4' }}>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className='w-full max-w-lg'
      >
        {/* Logo */}
        <div className='flex justify-center mb-8'>
          <img src='/logos/logo.png' style={{mixBlendMode: 'multiply'}} alt='LIGHT STUDIO' className='h-16 w-auto' />
        </div>

        {/* Payment banners */}
        <AnimatePresence>
          {paymentSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className='mb-5 px-4 py-3 rounded-xl text-sm font-medium text-green-800 bg-green-50 border border-green-200'
            >
              {t('onboarding.payment_success')}
            </motion.div>
          )}
          {upgradePending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className='mb-5 px-4 py-3 rounded-xl text-sm text-yellow-800 bg-yellow-50 border border-yellow-200'
            >
              {t('onboarding.payment_pending')}{' '}
              <a href='/admin/billing' className='font-semibold underline'>
                {t('onboarding.upgrade_now')}
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card */}
        <div className='bg-white rounded-2xl p-8 shadow-sm border border-gray-100'>
          <StepDots current={step} total={4} />

          <p className='text-xs font-semibold tracking-wider text-center mb-2' style={{ color: BLUSH }}>
            {t('onboarding.step_pre')} {step} {t('onboarding.step_suf')}
          </p>
          <h1
            className='text-2xl font-light text-center mb-8 text-[#1a1a1a]'
          >
            {/* {t(pageTitleKey)} */}
          </h1>

          {/* ── Step 1: Profile ── */}
          {step === 1 && (
            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>{t('onboarding.name_label')}</label>
                <input
                  type='text'
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('onboarding.name_placeholder')}
                  className='w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E7B8B5] transition-colors'
                />
              </div>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1.5'>{t('onboarding.studio_label')}</label>
                <input
                  type='text'
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  placeholder={t('onboarding.studio_placeholder')}
                  className='w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#E7B8B5] transition-colors'
                />
              </div>
              <div className='flex gap-3 pt-2'>
                <button
                  onClick={handleProfileNext}
                  disabled={savingProfile || !name.trim()}
                  className='flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50'
                  style={{ background: GRADIENT }}
                >
                  {savingProfile ? t('onboarding.saving') : t('onboarding.next')}
                </button>
                <button
                  onClick={handleProfileSkip}
                  className='px-5 py-3 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors'
                >
                  {t('onboarding.skip')}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Theme ── */}
          {step === 2 && (
            <div>
              <div className='grid grid-cols-2 gap-4 mb-6'>
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeClick(theme.id)}
                    className='relative rounded-xl border-2 p-4 text-left transition-all'
                    style={{
                      borderColor: selectedTheme === theme.id ? BLUSH : '#e5e7eb',
                      boxShadow: selectedTheme === theme.id ? `0 0 0 3px ${BLUSH}33` : 'none',
                    }}
                  >
                    {/* Preview swatch */}
                    <div
                      className='w-full h-14 rounded-lg mb-3 flex items-center justify-center gap-1.5'
                      style={{ background: theme.bg, border: '1px solid #e5e7eb' }}
                    >
                      <div className='w-3 h-3 rounded-full' style={{ background: theme.accent }} />
                      <div className='w-8 h-1.5 rounded-full' style={{ background: theme.accent, opacity: 0.4 }} />
                    </div>
                    <p className='text-sm font-semibold text-gray-800'>{t(theme.labelKey)}</p>
                    <p className='text-xs text-gray-400'>{t(theme.descKey)}</p>

                    {/* Saving / saved indicator */}
                    {selectedTheme === theme.id && (
                      <div className='absolute top-2.5 right-2.5'>
                        {savingTheme ? (
                          <div
                            className='w-4 h-4 border-2 rounded-full animate-spin'
                            style={{ borderColor: `${BLUSH} transparent transparent` }}
                          />
                        ) : savedTheme ? (
                          <svg className='w-4 h-4' fill='none' stroke={BLUSH} strokeWidth='2.5' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                          </svg>
                        ) : null}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className='flex gap-3'>
                <button
                  onClick={handleThemeNext}
                  className='flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all'
                  style={{ background: GRADIENT }}
                >
                  {t('onboarding.next')}
                </button>
                <button
                  onClick={handleThemeSkip}
                  className='px-5 py-3 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors'
                >
                  {t('onboarding.skip')}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Share ── */}
          {step === 3 && (
            <div className='text-center space-y-6'>
              <div className='space-y-1'>
                <p className='text-lg font-semibold' style={{ color: '#1a1a1a' }}>
                  {t('onboarding.page_live')}
                </p>
                <p className='text-sm text-gray-500'>{t('onboarding.share_desc')}</p>
              </div>

              {/* Share buttons grid */}
              <div className='grid grid-cols-2 gap-3'>
                {/* WhatsApp */}
                <button
                  onClick={shareWhatsApp}
                  className='flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700'
                >
                  <span className='w-8 h-8 rounded-full flex items-center justify-center shrink-0' style={{ background: '#25D36618' }}>
                    <svg className='w-4 h-4' viewBox='0 0 24 24' fill='#25D366'>
                      <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
                    </svg>
                  </span>
                  WhatsApp
                </button>

                {/* Facebook */}
                <button
                  onClick={shareFacebook}
                  className='flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700'
                >
                  <span className='w-8 h-8 rounded-full flex items-center justify-center shrink-0' style={{ background: '#1877F218' }}>
                    <svg className='w-4 h-4' viewBox='0 0 24 24' fill='#1877F2'>
                      <path d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' />
                    </svg>
                  </span>
                  Facebook
                </button>

                {/* SMS */}
                <button
                  onClick={shareSms}
                  className='flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700'
                >
                  <span className='w-8 h-8 rounded-full flex items-center justify-center shrink-0' style={{ background: '#6366f118' }}>
                    <svg className='w-4 h-4' fill='none' stroke='#6366f1' strokeWidth='2' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
                      />
                    </svg>
                  </span>
                  SMS
                </button>

                {/* Email */}
                <button
                  onClick={shareEmail}
                  className='flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700'
                >
                  <span className='w-8 h-8 rounded-full flex items-center justify-center shrink-0' style={{ background: '#f59e0b18' }}>
                    <svg className='w-4 h-4' fill='none' stroke='#f59e0b' strokeWidth='2' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                      />
                    </svg>
                  </span>
                  {t('onboarding.share_email')}
                </button>
              </div>

              {/* Copy link */}
              <button
                onClick={copyLink}
                className='w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed text-sm font-medium transition-all'
                style={{
                  borderColor: copied ? '#22c55e' : '#e5e7eb',
                  color: copied ? '#22c55e' : '#6b7280',
                  background: copied ? '#f0fdf4' : 'transparent',
                }}
              >
                {copied ? (
                  <>
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' strokeWidth='2.5' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                    </svg>
                    {t('onboarding.link_copied')}
                  </>
                ) : (
                  <>
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                      />
                    </svg>
                    {t('onboarding.copy_link')}
                  </>
                )}
              </button>

              {/* Next step */}
              <button
                onClick={() => persistStep(4)}
                className='w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90'
                style={{ background: GRADIENT }}
              >
                {t('onboarding.next')}
              </button>
            </div>
          )}

          {/* ── Step 4: What's next ── */}
          {step === 4 && (
            <div className='space-y-4'>
              <p className='text-sm text-gray-500 text-center mb-2'>{t('onboarding.step4.desc')}</p>

              {/* Action cards */}
              {[
                {
                  icon: (
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth='1.8' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
                    </svg>
                  ),
                  color: BLUSH,
                  titleKey: 'onboarding.step4.clients_title',
                  descKey: 'onboarding.step4.clients_desc',
                  path: '/admin/clients',
                },
                {
                  icon: (
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth='1.8' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' />
                    </svg>
                  ),
                  color: '#8B5CF6',
                  titleKey: 'onboarding.step4.dashboard_title',
                  descKey: 'onboarding.step4.dashboard_desc',
                  path: '/admin/dashboard',
                },
                {
                  icon: (
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth='1.8' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' /><path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                    </svg>
                  ),
                  color: '#22c55e',
                  titleKey: 'onboarding.step4.settings_title',
                  descKey: 'onboarding.step4.settings_desc',
                  path: '/admin/settings',
                },
              ].map((card) => (
                <button
                  key={card.path + card.titleKey}
                  onClick={() => goTo(card.path)}
                  className='w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left group'
                >
                  <span
                    className='w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors'
                    style={{ background: `${card.color}18`, color: card.color }}
                  >
                    {card.icon}
                  </span>
                  <div>
                    <p className='text-sm font-semibold text-gray-800'>{t(card.titleKey)}</p>
                    <p className='text-xs text-gray-400 mt-0.5'>{t(card.descKey)}</p>
                  </div>
                  <svg className='w-4 h-4 text-gray-300 group-hover:text-gray-400 ms-auto shrink-0 transition-colors rtl:rotate-180' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M9 5l7 7-7 7' />
                  </svg>
                </button>
              ))}

            </div>
          )}
        </div>

        {/* Skip entire onboarding */}
        {step !== 3 && step !== 4 && (
          <p className='text-center text-xs text-gray-400 mt-4'>
            <button onClick={completeOnboarding} className='hover:underline'>
              {t('onboarding.skip_setup')}
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
};
