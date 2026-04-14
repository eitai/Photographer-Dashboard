import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';

export const AdminLogin = () => {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInAdmin = await login(identifier, password);
      navigate(loggedInAdmin.role === 'superadmin' ? '/admin/users' : '/admin/dashboard');
    } catch {
      setError(t('admin.login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-white flex flex-col items-center justify-center px-4'>
      {/* Logo — large, outside the card */}
      <img src='/logos/01_logo_horizontal_light.png' alt='Koral' className='h-48 w-auto ' />
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
        </form>
      </div>
    </div>
  );
};
