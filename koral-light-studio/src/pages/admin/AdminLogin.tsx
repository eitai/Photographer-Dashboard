import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { Camera } from 'lucide-react';

export const AdminLogin = () => {
  const { login, admin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (admin) navigate('/admin/dashboard', { replace: true });
  }, [admin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/admin/dashboard');
    } catch {
      setError(t('admin.login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-ivory flex items-center justify-center px-4'>
      <div className='w-full max-w-sm'>
        {/* Logo */}
        <div className='text-center mb-8'>
          <div className='flex items-center justify-center gap-2 mb-2'>
            <Camera size={28} className='text-blush' />
            <span className=' text-2xl text-charcoal'>Koral</span>
          </div>
          <p className='text-warm-gray text-sm'>{t('admin.login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className='bg-card rounded-2xl shadow-sm border border-beige p-8 space-y-5'>
          <div>
            <label className='block text-sm text-charcoal mb-1.5'>{t('admin.login.email')}</label>
            <input
              type='text'
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              autoComplete='username'
              className='w-full px-4 py-2.5 rounded-lg border border-beige bg-ivory text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-blush/50'
            />
          </div>
          <div>
            <label className='block text-sm text-charcoal mb-1.5'>{t('admin.login.password')}</label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className='w-full px-4 py-2.5 rounded-lg border border-beige bg-ivory text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-blush/50'
            />
          </div>

          {error && <p className='text-rose-500 text-sm'>{error}</p>}

          <button
            type='submit'
            disabled={loading}
            className='w-full bg-blush text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors duration-150 disabled:opacity-60'
          >
            {loading ? t('admin.login.signing_in') : t('admin.login.sign_in')}
          </button>
        </form>
      </div>
    </div>
  );
};
