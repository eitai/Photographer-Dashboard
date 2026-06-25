import { useI18n } from '@/lib/i18n';
import type { CartItem } from './storeTypes';
import { formatPrice } from './storeTypes';

interface Props {
  cart: CartItem[];
  onRemove: (index: number) => void;
  onContinueShopping: () => void;
  onCheckout: () => void;
}

export function StoreCartView({ cart, onRemove, onContinueShopping, onCheckout }: Props) {
  const { t, dir } = useI18n();
  const total = cart.reduce((sum, item) => sum + item.product.clientPrice * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center gap-4 px-6' dir={dir}>
        <p className='text-lg font-sans text-charcoal/50'>{t('store.cart.empty')}</p>
        <button
          type='button'
          onClick={onContinueShopping}
          className='text-sm font-sans text-charcoal underline hover:no-underline'
        >
          {t('store.title')}
        </button>
      </div>
    );
  }

  return (
    <div className='flex flex-col flex-1 overflow-hidden' dir={dir}>
      <div className='shrink-0 px-4 pt-4 pb-3 border-b border-beige'>
        <h2 className='font-serif text-xl text-charcoal'>{t('store.cart')}</h2>
      </div>

      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-3'>
        {cart.map((item, i) => (
          <div key={`${item.product.id}-${i}`} className='flex items-start gap-3 bg-white border border-beige rounded-lg p-3'>
            <div className='w-12 h-12 rounded overflow-hidden shrink-0 bg-ivory'>
              {item.product.imagePreviewPath ? (
                <img src='' alt={item.product.name} className='w-full h-full object-cover' />
              ) : (
                <div className='w-full h-full bg-beige/30' />
              )}
            </div>
            <div className='flex-1 min-w-0'>
              <p className='font-sans text-sm font-medium text-charcoal truncate'>{item.product.name}</p>
              <p className='font-sans text-xs text-charcoal/50'>
                {t('store.quantity')}: {item.quantity}
                {item.selectedImageIds.length > 0 && (
                  <> · {item.selectedImageIds.length} {t('store.photos_selected')}</>
                )}
              </p>
              {Object.keys(item.productOptions ?? {}).length > 0 && (
                <p className='font-sans text-xs text-charcoal/50'>
                  {Object.entries(item.productOptions).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </p>
              )}
              <p className='font-sans text-sm font-semibold text-charcoal mt-0.5'>
                {formatPrice(item.product.clientPrice * item.quantity)}
              </p>
            </div>
            <button
              type='button'
              onClick={() => onRemove(i)}
              aria-label={`Remove ${item.product.name}`}
              className='text-xs font-sans text-charcoal/40 hover:text-red-500 transition-colors shrink-0 mt-0.5'
            >
              {t('store.cart.remove')}
            </button>
          </div>
        ))}
      </div>

      <div className='shrink-0 px-4 pb-4 pt-3 border-t border-beige space-y-3'>
        <div className='flex items-center justify-between'>
          <span className='font-sans text-sm text-charcoal/60'>{t('store.cart.total')}</span>
          <span className='font-sans font-bold text-charcoal text-lg'>{formatPrice(total)}</span>
        </div>
        <div className='flex gap-3'>
          <button
            type='button'
            onClick={onContinueShopping}
            className='flex-1 h-10 rounded-lg border border-beige text-sm font-sans text-charcoal hover:bg-ivory transition-colors'
          >
            {t('store.title')}
          </button>
          <button
            type='button'
            onClick={onCheckout}
            className='flex-1 h-10 rounded-lg bg-charcoal text-white text-sm font-sans font-medium hover:bg-charcoal/90 transition-colors'
          >
            {t('store.cart.checkout')}
          </button>
        </div>
      </div>
    </div>
  );
}
