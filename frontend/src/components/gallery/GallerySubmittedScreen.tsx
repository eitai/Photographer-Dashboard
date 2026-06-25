import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';

export function GallerySubmittedScreen() {
  const { t } = useI18n();
  return (
    <main className='flex-1 flex items-center justify-center bg-background'>
      <FadeIn>
        <div className='text-center px-6 max-w-md'>
          <span className='inline-flex items-center justify-center w-14 h-14 rounded-full bg-flag text-white mb-6' aria-hidden='true'>
            <svg className='w-7 h-7' viewBox='0 0 24 24' fill='currentColor' stroke='currentColor' strokeWidth='1.5'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z'
              />
            </svg>
          </span>
          <h1 className='font-display text-3xl md:text-4xl leading-tight text-foreground mb-4'>{t('gallery.thank_you')}</h1>
          <p className='font-body text-muted-foreground mb-8'>{t('gallery.review_choices')}</p>
          <button
            onClick={() => window.close()}
            className='px-7 py-3 rounded-full border border-border bg-background text-sm font-body text-muted-foreground
              transition-colors hover:border-foreground hover:text-foreground
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
          >
            {t('gallery.close_window')}
          </button>
        </div>
      </FadeIn>
    </main>
  );
}
