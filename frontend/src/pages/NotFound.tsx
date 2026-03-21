import { useI18n } from '@/lib/i18n';

export const NotFound = () => {
  const { t } = useI18n();
  return (
    <div className='min-h-screen bg-ivory flex items-center justify-center px-6'>
      <div className='text-center max-w-sm'>
        <p className=' text-8xl text-blush mb-4'>404</p>
        <h1 className=' text-2xl text-charcoal mb-3'>{t('notfound.title')}</h1>
        <p className='text-sm text-warm-gray leading-relaxed'>{t('notfound.body')}</p>
      </div>
    </div>
  );
};
