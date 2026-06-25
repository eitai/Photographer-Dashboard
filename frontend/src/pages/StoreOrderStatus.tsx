import { useParams } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { useStoreOrderStatus } from '@/hooks/useQueries';

export const StoreOrderStatus = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { t, dir } = useI18n();

  const searchParams = new URLSearchParams(window.location.search);
  const failed = searchParams.get('failed') === '1';

  const { data, isLoading } = useStoreOrderStatus(orderId ?? '', !failed);

  const header = (
    <header className='h-20 shrink-0 flex items-center px-6 bg-white border-b border-beige'>
      <img src='/logos/logo.png' style={{mixBlendMode: 'multiply'}} alt='LIGHT STUDIO' className='h-14 w-auto' />
    </header>
  );

  const themeWrapper = (children: React.ReactNode) => (
    <div
      data-theme='bw'
      dir={dir}
      style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}
      className='flex flex-col'
    >
      {children}
    </div>
  );

  // Payment failed (URL flag set by PayPlus redirect)
  if (failed) {
    return themeWrapper(
      <>
        {header}
        <div className='flex-1 flex items-center justify-center px-4'>
          <div className='bg-white border border-beige rounded-xl p-8 max-w-sm w-full text-center shadow-sm space-y-4'>
            <div className='w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto'>
              <svg viewBox='0 0 24 24' fill='none' className='w-7 h-7 text-red-400' stroke='currentColor' strokeWidth='2'>
                <circle cx='12' cy='12' r='10' />
                <path d='M15 9l-6 6M9 9l6 6' strokeLinecap='round' />
              </svg>
            </div>
            <h1 className='font-serif text-xl text-charcoal'>{t('store.order.title')}</h1>
            <p className='text-sm font-sans text-charcoal/60'>{t('store.order.failed')}</p>
            <a
              href='/'
              className='inline-block mt-2 text-sm font-sans text-charcoal underline hover:no-underline'
            >
              {t('store.order.back_to_gallery')}
            </a>
          </div>
        </div>
      </>
    );
  }

  // Loading / polling state
  if (isLoading || !data) {
    return themeWrapper(
      <>
        {header}
        <div className='flex-1 flex items-center justify-center px-4'>
          <div className='bg-white border border-beige rounded-xl p-8 max-w-sm w-full text-center shadow-sm space-y-4'>
            <div className='w-14 h-14 rounded-full bg-ivory flex items-center justify-center mx-auto'>
              <div
                className='w-7 h-7 border-2 border-t-transparent rounded-full animate-spin'
                style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
              />
            </div>
            <h1 className='font-serif text-xl text-charcoal'>{t('store.order.title')}</h1>
            <p className='text-sm font-sans text-charcoal/60'>{t('store.order.pending')}</p>
          </div>
        </div>
      </>
    );
  }

  const isPaid = data.paymentStatus === 'paid';
  const isCancelled =
    data.status === 'cancelled' ||
    data.paymentStatus === 'refunded' ||
    data.paymentStatus === 'failed';

  // Cancelled / refunded state
  if (isCancelled) {
    return themeWrapper(
      <>
        {header}
        <div className='flex-1 flex items-center justify-center px-4'>
          <div className='bg-white border border-beige rounded-xl p-8 max-w-sm w-full text-center shadow-sm space-y-4'>
            <div className='w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto'>
              <svg viewBox='0 0 24 24' fill='none' className='w-7 h-7 text-red-400' stroke='currentColor' strokeWidth='2'>
                <circle cx='12' cy='12' r='10' />
                <path d='M15 9l-6 6M9 9l6 6' strokeLinecap='round' />
              </svg>
            </div>
            <h1 className='font-serif text-xl text-charcoal'>{t('store.order.title')}</h1>
            <p className='text-sm font-sans text-charcoal/60'>{t('store.order.failed')}</p>
            <a href='/' className='inline-block text-sm font-sans text-charcoal underline hover:no-underline'>
              {t('store.order.back_to_gallery')}
            </a>
          </div>
        </div>
      </>
    );
  }

  // Still pending payment
  if (!isPaid) {
    return themeWrapper(
      <>
        {header}
        <div className='flex-1 flex items-center justify-center px-4'>
          <div className='bg-white border border-beige rounded-xl p-8 max-w-sm w-full text-center shadow-sm space-y-4'>
            <div className='w-14 h-14 rounded-full bg-ivory flex items-center justify-center mx-auto'>
              <div
                className='w-7 h-7 border-2 border-t-transparent rounded-full animate-spin'
                style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
              />
            </div>
            <h1 className='font-serif text-xl text-charcoal'>{t('store.order.title')}</h1>
            <p className='text-sm font-sans text-charcoal/60'>{t('store.order.pending')}</p>
            <p className='text-xs font-sans text-charcoal/40'>
              {t('store.order.number')}: {data.id}
            </p>
          </div>
        </div>
      </>
    );
  }

  // Paid / success state
  return themeWrapper(
    <>
      {header}
      <div className='flex-1 flex items-center justify-center px-4'>
        <div className='bg-white border border-beige rounded-xl p-8 max-w-sm w-full text-center shadow-sm space-y-4'>
          <div className='w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto'>
            <svg viewBox='0 0 24 24' fill='none' className='w-7 h-7 text-green-500' stroke='currentColor' strokeWidth='2'>
              <circle cx='12' cy='12' r='10' />
              <path d='M8 12l3 3 5-5' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          </div>
          <h1 className='font-serif text-xl text-charcoal'>{t('store.order.title')}</h1>
          <p className='text-sm font-sans text-charcoal'>{t('store.order.paid')}</p>
          <div className='border-t border-beige pt-4 space-y-1 text-sm font-sans text-charcoal/60'>
            <p>
              <span className='font-medium text-charcoal'>{t('store.order.number')}:</span> {data.id.slice(0, 8).toUpperCase()}
            </p>
            {data.totalAmount !== null && (
              <p>
                <span className='font-medium text-charcoal'>{t('store.order.total')}:</span>{' '}
                ₪{data.totalAmount.toLocaleString('he-IL')}
              </p>
            )}
            {(data.status === 'shipped' || data.status === 'delivered') && data.trackingNumber && (
              <div className='mt-3 pt-3 border-t border-beige space-y-1'>
                <p className='font-medium text-charcoal text-xs uppercase tracking-wide'>
                  {dir === 'rtl' ? 'פרטי משלוח' : 'Shipping Info'}
                </p>
                <p>
                  <span className='font-medium text-charcoal'>{t('orders.tracking')}:</span>{' '}
                  {data.trackingNumber}
                </p>
                {data.trackingCarrier && (
                  <p>
                    <span className='font-medium text-charcoal'>{t('orders.tracking.carrier')}:</span>{' '}
                    {data.trackingCarrier}
                  </p>
                )}
                {data.shippedAt && (
                  <p className='text-xs text-charcoal/40'>
                    {dir === 'rtl' ? 'נשלח ב-' : 'Shipped '}
                    {new Date(data.shippedAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}
                  </p>
                )}
              </div>
            )}
          </div>
          {data.receiptUrl && (
            <a
              href={data.receiptUrl}
              target='_blank'
              rel='noreferrer'
              className='inline-block bg-charcoal text-white text-sm font-sans rounded-full px-5 py-2.5 hover:bg-charcoal/90 transition-colors'
            >
              {t('store.order.download_receipt')}
            </a>
          )}
          <a
            href='/'
            className='block text-sm font-sans text-charcoal underline hover:no-underline'
          >
            {t('store.order.back_to_gallery')}
          </a>
        </div>
      </div>
    </>
  );
};
