import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';

export const NotFound = () => {
  const { t } = useI18n();
  return (
    <div className='min-h-screen bg-ivory flex items-center justify-center px-6'>
      <div className='text-center max-w-sm'>
        <p className=' text-8xl text-blush mb-4'>404</p>
        <h1 className=' text-2xl text-charcoal mb-3'>{t('notfound.title')}</h1>
        <p className='text-sm text-warm-gray mb-8 leading-relaxed'>{t('notfound.body')}</p>
        <Link
          to='/admin'
          className='inline-block px-6 py-2.5 rounded-lg bg-blush text-charcoal text-sm font-medium hover:bg-blush/80 transition-colors'
        >
          {t('notfound.cta')}
        </Link>
      </div>
    </div>
  );
};
