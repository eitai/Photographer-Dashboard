import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { API_BASE, registerPhotographer, checkoutPlan } from '@/lib/api';
import { usePublicPlans } from '@/hooks/useQueries';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/lib/i18n';

function fmtPrice(price: number, interval: string, t: (k: string) => string): string {
  if (price === 0) return t('landing.pricing.cta_free');
  const displayed = interval === 'annual' ? price / 12 : price;
  return `₪${displayed % 1 === 0 ? displayed : displayed.toFixed(1)}${t('landing.pricing.per_month')}`;
}

export const GetStartedPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, lang } = useI18n();
  const isHe = lang === 'he';
  const { admin, setAdmin } = useAuthStore();
  const reduced = useReducedMotion();

  const planSlug = searchParams.get('plan') || 'free';
  const interval = (searchParams.get('interval') as 'monthly' | 'annual') || 'monthly';

  const { data: plans = [] } = usePublicPlans();
  const selectedPlan = plans.find((p) => p.slug === planSlug) ?? null;
  const isFree = !selectedPlan || selectedPlan.slug === 'free' || selectedPlan.priceMonthlyIls === 0;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (admin) navigate('/admin/dashboard', { replace: true });
  }, [admin, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEmailTaken(false);
    setSubmitting(true);

    try {
      const result = await registerPhotographer({ email, password });
      const newAdmin = result.admin;
      setAdmin(newAdmin);
      localStorage.setItem('koral_admin_user', JSON.stringify(newAdmin));

      if (!isFree && selectedPlan) {
        const FRONTEND_URL = window.location.origin;
        const { url } = await checkoutPlan(selectedPlan.id, interval, undefined);
        // PayPlus uses successUrl/cancelUrl embedded in the checkout call via backend
        // We append our redirect params to the success/cancel via backend config,
        // but if the URL is already set we just redirect to it
        window.location.href = url || `${FRONTEND_URL}/onboarding`;
        return;
      }

      navigate('/onboarding');
    } catch (err: unknown) {
      const status = (err as { response?: { status: number; data?: { message?: string } } })?.response?.status;
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 409) {
        setError(t('getstarted.register.email_taken'));
        setEmailTaken(true);
      } else if (msg) {
        setError(msg);
      } else {
        setError(t('getstarted.register.error'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-theme='bw' className='min-h-screen bg-white font-body lg:grid lg:grid-cols-2'>

      {/* Photo panel — desktop only. Warm, inviting golden-hour placeholder
          from public/landing/ (see README there for replacement guide). */}
      <div className='relative hidden lg:block overflow-hidden' aria-hidden='true'>
        <img src='/landing/getstarted-01.jpg' alt='' className='absolute inset-0 h-full w-full object-cover' />
        <div className='absolute inset-0 bg-gradient-to-t from-[#111111]/70 via-transparent to-transparent' />

        {/* Floating gallery chip — the "your work, delivered" motif */}
        <div className='absolute top-10 start-10 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/90 backdrop-blur px-4 py-3 shadow-lg'>
          <div className='flex -space-x-2 rtl:space-x-reverse'>
            <img src='/landing/wedding-01.jpg' alt='' className='h-9 w-9 rounded-lg border-2 border-white object-cover' />
            <img src='/landing/family-01.jpg' alt='' className='h-9 w-9 rounded-lg border-2 border-white object-cover' />
            <img src='/landing/portrait-01.jpg' alt='' className='h-9 w-9 rounded-lg border-2 border-white object-cover' />
          </div>
          <div>
            <p className='text-xs font-semibold text-[#111111]'>{isHe ? 'הגלריה נשלחה ללקוח' : 'Gallery sent to client'}</p>
            <p className='text-[11px] text-[#5C5C66]'>{isHe ? 'באימייל וב-SMS, אוטומטית' : 'By email & SMS, automatically'}</p>
          </div>
        </div>

        <div className='absolute bottom-10 start-10 end-10'>
          <p className='font-display text-3xl leading-snug text-white'>
            {isHe ? 'הגלריה הראשונה שלך מחכה.' : 'Your first gallery is waiting.'}
          </p>
          <p className='mt-2 text-sm text-white/75'>
            {isHe ? 'נרשמים בדקה, מעלים עוד היום — בחינם.' : 'Sign up in a minute, upload today — free.'}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className='flex min-h-screen flex-col items-center justify-center px-4 py-12 lg:min-h-0'>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className='w-full max-w-md'
      >
        {/* Back link */}
        {planSlug !== 'free' && (
          <Link
            to='/pricing'
            className='inline-flex items-center gap-1.5 text-sm text-[#5C5C66] hover:text-[#111111] transition-colors mb-8'
          >
            <svg className='w-4 h-4 rtl:rotate-180' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24' aria-hidden='true'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7' />
            </svg>
            {t('getstarted.back_to_pricing')}
          </Link>
        )}

        {/* Logo */}
        <div className='text-center mb-8'>
          <Link to='/' className='inline-block'>
            <img src='/logos/logo.png' alt='LIGHT STUDIO' className='h-24 w-auto mx-auto mix-blend-multiply' />
          </Link>
        </div>

        {/* Plan badge */}
        <AnimatePresence>
          {selectedPlan && !isFree && (
            <motion.div
              initial={reduced ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className='flex items-center justify-center gap-2 mb-6'
            >
              <span className='inline-flex items-center gap-2 rounded-full bg-[#FBF3E3] border border-[#F5A623]/40 px-4 py-2 text-sm font-medium text-[#9A6A0B]'>
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' strokeWidth='2.5' viewBox='0 0 24 24' aria-hidden='true'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                </svg>
                {selectedPlan.name} · {fmtPrice(
                  interval === 'annual' ? selectedPlan.priceAnnualIls : selectedPlan.priceMonthlyIls,
                  interval,
                  t,
                )}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card */}
        <div className='rounded-2xl border border-[#E8E8EC] bg-white p-8 shadow-[0_16px_50px_-24px_rgba(17,17,17,0.15)]'>
          <h1 className='font-display text-2xl text-center text-[#111111] mb-6'>
            {t('getstarted.register.title')}
          </h1>

          {/* Google button */}
          <a
            href={`${API_BASE}/api/auth/google`}
            className='flex items-center justify-center gap-3 w-full py-3 rounded-xl border border-[#E8E8EC] text-sm font-medium text-[#111111]
              hover:border-[#111111] transition-colors mb-4
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24' aria-hidden='true'>
              <path fill='#4285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' />
              <path fill='#34A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' />
              <path fill='#FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' />
              <path fill='#EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' />
            </svg>
            {t('getstarted.google')}
          </a>

          {/* Divider */}
          <div className='flex items-center gap-3 mb-4'>
            <div className='flex-1 h-px bg-[#E8E8EC]' />
            <span className='text-xs text-[#5C5C66]'>{t('admin.login.or')}</span>
            <div className='flex-1 h-px bg-[#E8E8EC]' />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label htmlFor='gs-email' className='block text-xs font-medium text-[#5C5C66] mb-1.5'>
                {t('getstarted.register.email')}
              </label>
              <input
                id='gs-email'
                type='email'
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className='w-full px-4 py-3 rounded-xl border border-[#E8E8EC] bg-white text-sm text-[#111111] outline-none
                  focus:border-[#111111] transition-colors placeholder:text-[#A0A0AA]'
                placeholder={t('getstarted.email_placeholder')}
              />
            </div>

            <div>
              <label htmlFor='gs-password' className='block text-xs font-medium text-[#5C5C66] mb-1.5'>
                {t('getstarted.register.password')}
              </label>
              <div className='relative'>
                <input
                  id='gs-password'
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='w-full px-4 py-3 pe-11 rounded-xl border border-[#E8E8EC] bg-white text-sm text-[#111111] outline-none
                    focus:border-[#111111] transition-colors placeholder:text-[#A0A0AA]'
                  placeholder={t('getstarted.password_placeholder')}
                />
                <button
                  type='button'
                  onClick={() => setShowPw((v) => !v)}
                  className='absolute end-3.5 top-1/2 -translate-y-1/2 text-[#A0A0AA] hover:text-[#111111] transition-colors'
                  tabIndex={-1}
                  aria-hidden='true'
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={reduced ? { opacity: 1 } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  className='text-sm text-red-600'
                  role='alert'
                >
                  {error}{' '}
                  {emailTaken && (
                    <Link to='/login' className='underline font-medium text-[#111111]'>{t('landing.nav.login')}</Link>
                  )}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type='submit'
              disabled={submitting}
              className='w-full py-3.5 rounded-full bg-[#111111] text-sm font-medium text-white
                transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'
            >
              {submitting ? t('getstarted.register.submitting') : t('getstarted.register.submit')}
            </button>
          </form>
        </div>

        {/* Log in link */}
        <p className='text-center text-sm text-[#5C5C66] mt-5'>
          {t('getstarted.already')}{' '}
          <Link to='/login' className='font-medium text-[#111111] hover:underline'>
            {t('landing.nav.login')}
          </Link>
        </p>
      </motion.div>
      </div>
    </div>
  );
};
