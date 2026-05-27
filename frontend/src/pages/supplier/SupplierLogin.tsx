import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSupplierAuth } from '@/hooks/useSupplierAuth';
import { useI18n } from '@/lib/i18n';

export const SupplierLogin = () => {
  const { login } = useSupplierAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/supplier/products');
    } catch {
      const msg = t('supplier.login.error');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-ivory flex flex-col items-center justify-center px-4'>
      <img
        src='/logos/01_logo_horizontal_light.png'
        alt='LIGHT STUDIO'
        className='h-40 w-auto mb-6'
      />

      <div className='w-full max-w-sm'>
        <h1 className='font-serif text-2xl text-charcoal text-center mb-6'>
          {t('supplier.login.title')}
        </h1>

        <form
          onSubmit={handleSubmit}
          className='bg-white border border-zinc-200 rounded-2xl p-8 space-y-5 shadow-sm'
        >
          <div>
            <label className='block text-zinc-900 text-xs uppercase tracking-widest mb-2'>
              {t('admin.common.email')}
            </label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete='email'
              className='w-full bg-white border border-zinc-300 text-zinc-900 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-blush focus:border-blush'
            />
          </div>

          <div>
            <label className='block text-zinc-900 text-xs uppercase tracking-widest mb-2'>
              {t('admin.login.password')}
            </label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete='current-password'
              className='w-full bg-white border border-zinc-300 text-zinc-900 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-blush focus:border-blush'
            />
          </div>

          {error && <p className='text-red-500 text-sm'>{error}</p>}

          <button
            type='submit'
            disabled={loading}
            className='w-full bg-blush text-white font-medium rounded-xl py-3 hover:bg-blush/90 transition-colors disabled:opacity-50'
          >
            {loading ? '…' : t('supplier.login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
};
