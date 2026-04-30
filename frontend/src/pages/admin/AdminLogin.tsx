import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { API_BASE } from '@/lib/api';
import { SSOSetupModal } from '@/components/admin/SSOSetupModal';

export const AdminLogin = () => {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSSOModal, setShowSSOModal] = useState(false);
  const [postLoginDest, setPostLoginDest] = useState('/admin/dashboard');

  // Show toast when Google redirects back with an SSO error
  useEffect(() => {
    const sso = searchParams.get('sso');
    const reason = searchParams.get('reason');
    if (sso !== 'error') return;
    const msg =
      reason === 'no_account' ? t('admin.login.sso_error_no_account') :
      reason === 'sso_disabled' ? t('admin.login.sso_error_disabled') :
      t('admin.login.sso_error');
    toast.error(msg);
    setError(msg);
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInAdmin = await login(identifier, password);
      const dest = loggedInAdmin.role === 'superadmin' ? '/admin/users' : '/admin/dashboard';
      if (loggedInAdmin.firstLogin) {
        setPostLoginDest(dest);
        setShowSSOModal(true);
        // Don't navigate yet — modal handles it so the user actually sees it
      } else {
        navigate(dest);
      }
    } catch {
      setError(t('admin.login.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  return (
    <>
      <div className='min-h-screen bg-white flex flex-col items-center justify-center px-4'>
        {/* Logo — large, outside the card */}
        <img src='/logos/01_logo_horizontal_light.png' alt='LIGHT STUDIO' className='h-48 w-auto ' />
        <div className='w-full max-w-sm'>
          <form onSubmit={handleSubmit} className='border border-zinc-200 rounded-2xl p-8 space-y-5'>
            <div>
              <label className='block text-zinc-900 text-xs uppercase tracking-widest mb-2'>{t('admin.login.email')}</label>
              <input
                type='text'
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                autoComplete='username'
                className='w-full bg-white border border-zinc-300 text-zinc-900 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black'
              />
            </div>

            <div>
              <label className='block text-zinc-900 text-xs uppercase tracking-widest mb-2'>{t('admin.login.password')}</label>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete='current-password'
                className='w-full bg-white border border-zinc-300 text-zinc-900 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black'
              />
            </div>

            {error && <p className='text-red-500 text-sm'>{error}</p>}

            <button
              type='submit'
              disabled={loading}
              className='w-full bg-zinc-900 text-white font-medium rounded-xl py-3 hover:bg-black transition-colors disabled:opacity-50'
            >
              {loading ? t('admin.login.signing_in') : t('admin.login.sign_in')}
            </button>

            {/* Divider */}
            <div className='flex items-center gap-3'>
              <div className='flex-1 h-px bg-zinc-200' />
              <span className='text-xs text-zinc-400 uppercase tracking-widest'>{t('admin.login.or')}</span>
              <div className='flex-1 h-px bg-zinc-200' />
            </div>

            {/* Google SSO button */}
            <button
              type='button'
              onClick={handleGoogleSignIn}
              className='w-full flex items-center justify-center gap-3 bg-white border border-zinc-300 rounded-xl py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors'
            >
              {/* Google G logo */}
              <svg width='18' height='18' viewBox='0 0 24 24' aria-hidden='true'>
                <path
                  d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                  fill='#4285F4'
                />
                <path
                  d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                  fill='#34A853'
                />
                <path
                  d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z'
                  fill='#FBBC05'
                />
                <path
                  d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                  fill='#EA4335'
                />
              </svg>
              {t('admin.login.google')}
            </button>
          </form>
        </div>
      </div>

      {/* First-login SSO setup prompt */}
      <SSOSetupModal
        open={showSSOModal}
        onClose={() => { setShowSSOModal(false); navigate(postLoginDest); }}
      />
    </>
  );
};
