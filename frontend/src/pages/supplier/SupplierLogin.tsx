import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
      navigate('/supplier');
    } catch {
      const msg = t('supplier.login.error');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-theme="bw" className='min-h-screen flex'>
      {/* Left panel — dark, logo + tagline */}
      <div className='hidden md:flex flex-col items-center justify-center w-1/2 px-12 bg-zinc-900'>
        <div className='w-full max-w-xs flex flex-col items-center'>
          <img
            src='/logos/logo.png'
            style={{ mixBlendMode: 'screen' }}
            alt='LIGHT STUDIO'
            className='h-28 w-auto object-contain mb-8'
          />
          <p className='text-center text-sm leading-relaxed text-white/45'>
            {t('supplier.login.title')}
          </p>
        </div>
      </div>

      {/* Right panel — white, form */}
      <div className='flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white'>
        {/* Mobile: show logo above form */}
        <div className='md:hidden mb-8 text-center'>
          <img
            src='/logos/logo.png'
            style={{ mixBlendMode: 'multiply' }}
            alt='LIGHT STUDIO'
            className='h-16 w-auto object-contain mx-auto mb-3'
          />
        </div>

        <div className='w-full max-w-sm'>
          {/* Form heading */}
          <h1 className='text-2xl font-semibold text-zinc-900 tracking-tight mb-1'>
            {t('supplier.login.title')}
          </h1>
          <p className='text-sm text-zinc-400 mb-8'>
            {t('supplier.login.title')}
          </p>

          <form onSubmit={handleSubmit} className='space-y-5' noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor='supplier-email'
                className='block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2'
              >
                {t('admin.common.email')}
              </label>
              <input
                id='supplier-email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete='email'
                className='w-full border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow duration-150 placeholder:text-zinc-300 bg-zinc-50'
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor='supplier-password'
                className='block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2'
              >
                {t('admin.login.password')}
              </label>
              <input
                id='supplier-password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete='current-password'
                className='w-full border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow duration-150 placeholder:text-zinc-300 bg-zinc-50'
              />
            </div>

            {/* Inline error */}
            {error && (
              <p className='text-sm text-red-500 font-medium' role='alert'>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type='submit'
              disabled={loading}
              className='w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-60 cursor-pointer bg-zinc-900 mt-2 hover:bg-zinc-700'
            >
              {loading && <Loader2 size={16} className='animate-spin' />}
              {t('supplier.login.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
