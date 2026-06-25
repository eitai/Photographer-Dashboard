import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { API_BASE } from '@/lib/api';

export const PhotographerLogin = () => {
  const { login } = useAuth();
  const { t, lang } = useI18n();
  const isHe = lang === 'he';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sso = searchParams.get('sso');
    const reason = searchParams.get('reason');
    const detail = searchParams.get('detail');
    if (sso !== 'error') return;
    console.error('[SSO] Photographer login failed — reason:', reason, '| detail:', detail);
    const msg =
      reason === 'no_account' ? t('admin.login.sso_error_no_account') :
      reason === 'sso_disabled' ? t('admin.login.sso_error_disabled') :
      reason === 'use_admin_portal' ? t('admin.login.sso_error_use_admin_portal') :
      t('admin.login.sso_error');
    toast.error(msg);
    setError(msg);
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setError(t('admin.login.error_use_admin_portal'));
      } else {
        setError(t('admin.login.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  return (
    <div data-theme='bw' className='min-h-screen bg-white font-body lg:grid lg:grid-cols-2'>

      {/* Photo panel — desktop only. Placeholder photography from public/landing/ */}
      <div className='relative hidden lg:block overflow-hidden' aria-hidden='true'>
        <img src='/landing/camera-01.jpg' alt='' className='absolute inset-0 h-full w-full object-cover' />
        <div className='absolute inset-0 bg-gradient-to-t from-[#111111]/75 via-[#111111]/10 to-transparent' />

        {/* Floating "selection" card — echoes the landing hero motif */}
        <div className='absolute top-10 start-10 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/90 backdrop-blur px-4 py-3 shadow-lg'>
          <img src='/landing/couple-01.jpg' alt='' className='h-10 w-10 rounded-lg object-cover' />
          <div>
            <p className='text-xs font-semibold text-[#111111]'>{isHe ? 'נועה הגישה בחירה' : 'Noa submitted her picks'}</p>
            <p className='text-[11px] text-[#5C5C66]'>{isHe ? '42 תמונות · לפני רגע' : '42 photos · just now'}</p>
          </div>
          <span className='ms-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#F5A623] text-white'>
            <svg className='h-3.5 w-3.5' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z' />
            </svg>
          </span>
        </div>

        <div className='absolute bottom-10 start-10 end-10'>
          <p className='font-display text-3xl leading-snug text-white'>
            {isHe ? 'כל גלריה. כל לקוח. כל שלב.' : 'Every gallery. Every client. Every stage.'}
          </p>
          <p className='mt-2 text-sm text-white/70'>
            {isHe ? 'התחברו כדי להמשיך מאיפה שעצרתם.' : 'Sign in to pick up where you left off.'}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className='flex min-h-screen flex-col items-center justify-center px-4 py-12 lg:min-h-0'>
        <div className='w-full max-w-sm'>
          <div className='text-center mb-8'>
            <Link to='/' className='inline-block'>
              <img src='/logos/logo.png' alt='LIGHT STUDIO' className='h-24 w-auto mx-auto mix-blend-multiply' />
            </Link>
            <h1 className='mt-4 font-display text-xl text-[#111111]'>
              {isHe ? 'ברוך הבא' : 'Welcome back'}
            </h1>
          </div>

          <form onSubmit={handleSubmit}
            className='rounded-2xl border border-[#E8E8EC] bg-white p-8 space-y-5 shadow-[0_16px_50px_-24px_rgba(17,17,17,0.15)]'>
            <div>
              <label htmlFor='login-identifier' className='block text-xs font-medium text-[#5C5C66] mb-1.5'>
                {t('admin.login.email')}
              </label>
              <input
                id='login-identifier'
                type='text'
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                autoComplete='username'
                className='w-full px-4 py-3 rounded-xl border border-[#E8E8EC] bg-white text-sm text-[#111111] outline-none
                  focus:border-[#111111] transition-colors placeholder:text-[#A0A0AA]'
              />
            </div>

            <div>
              <label htmlFor='login-password' className='block text-xs font-medium text-[#5C5C66] mb-1.5'>
                {t('admin.login.password')}
              </label>
              <input
                id='login-password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete='current-password'
                className='w-full px-4 py-3 rounded-xl border border-[#E8E8EC] bg-white text-sm text-[#111111] outline-none
                  focus:border-[#111111] transition-colors placeholder:text-[#A0A0AA]'
              />
            </div>

            {error && <p className='text-sm text-red-600' role='alert'>{error}</p>}

            <button
              type='submit'
              disabled={loading}
              className='w-full py-3.5 rounded-full bg-[#111111] text-sm font-medium text-white
                transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'
            >
              {loading ? t('admin.login.signing_in') : t('admin.login.sign_in')}
            </button>

            {/* Divider */}
            <div className='flex items-center gap-3'>
              <div className='flex-1 h-px bg-[#E8E8EC]' />
              <span className='text-xs text-[#5C5C66]'>{t('admin.login.or')}</span>
              <div className='flex-1 h-px bg-[#E8E8EC]' />
            </div>

            {/* Google SSO button */}
            <button
              type='button'
              onClick={handleGoogleSignIn}
              className='w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-[#E8E8EC] text-sm font-medium text-[#111111]
                hover:border-[#111111] transition-colors
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'
            >
              <svg width='18' height='18' viewBox='0 0 24 24' aria-hidden='true'>
                <path d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' fill='#4285F4' />
                <path d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' fill='#34A853' />
                <path d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z' fill='#FBBC05' />
                <path d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' fill='#EA4335' />
              </svg>
              {t('admin.login.google')}
            </button>

            {/* Register link */}
            <p className='text-center text-sm text-[#5C5C66]'>
              {t('admin.login.no_account')}{' '}
              <Link to='/get-started' className='font-medium text-[#111111] hover:underline'>
                {t('admin.login.register')}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
