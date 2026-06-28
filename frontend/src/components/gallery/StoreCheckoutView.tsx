import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { storeCheckout } from '@/lib/api';
import type { StoreCheckoutRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { CartItem, ShippingFormState, ShippingErrors } from './storeTypes';
import { formatPrice } from './storeTypes';

interface Props {
  cart: CartItem[];
  galleryToken: string;
  onBack: () => void;
}

export function StoreCheckoutView({ cart, galleryToken, onBack }: Props) {
  const { t, dir } = useI18n();
  const { toast } = useToast();
  const [shipping, setShipping] = useState<ShippingFormState>({
    name: '', street: '', apartment: '', city: '', zip: '', country: 'ישראל', phone: '',
  });
  const [clientNote, setClientNote] = useState('');
  const [errors, setErrors] = useState<ShippingErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.product.clientPrice * item.quantity, 0);

  const checkoutMutation = useMutation({
    mutationFn: (data: StoreCheckoutRequest) => storeCheckout(galleryToken, data),
    onSuccess: (res) => { window.location.href = res.url; },
    onError: (err: unknown) => {
      // Backend store routes return errors as { message } (422/503/400 etc.) —
      // surface that so the client sees the real reason instead of a generic toast.
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('store.checkout.error');
      toast({ title: message, variant: 'destructive' });
    },
  });

  function validate(): ShippingErrors {
    const errs: ShippingErrors = {};
    if (!shipping.name.trim()) errs.name = t('store.checkout.name') + ' ' + t('store.checkout.required');
    if (!shipping.street.trim()) errs.street = t('store.checkout.street') + ' ' + t('store.checkout.required');
    if (!shipping.city.trim()) errs.city = t('store.checkout.city') + ' ' + t('store.checkout.required');
    return errs;
  }

  function handleShippingChange(field: keyof ShippingFormState, value: string) {
    setShipping((prev) => ({ ...prev, [field]: value }));
    if (submitAttempted) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handlePay() {
    setSubmitAttempted(true);
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    checkoutMutation.mutate({
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        selectedImageIds: item.selectedImageIds,
        imageNotes: Object.keys(item.imageNotes).length > 0 ? item.imageNotes : undefined,
        productOptions: Object.keys(item.productOptions ?? {}).length > 0 ? item.productOptions : undefined,
      })),
      shippingAddress: {
        name: shipping.name.trim(),
        street: shipping.street.trim(),
        apartment: shipping.apartment.trim() || undefined,
        city: shipping.city.trim(),
        zip: shipping.zip.trim() || undefined,
        country: shipping.country.trim() || 'ישראל',
        phone: shipping.phone.trim() || undefined,
      },
      clientNote: clientNote.trim() || undefined,
    });
  }

  const inputClass = (err?: string) =>
    cn('w-full h-10 px-3 text-sm font-sans border rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors',
      err ? 'border-red-400' : 'border-beige');

  return (
    <div className='flex flex-col flex-1 overflow-hidden' dir={dir}>
      <div className='shrink-0 px-4 pt-4 pb-3 border-b border-beige'>
        <h2 className='font-serif text-xl text-charcoal'>{t('store.checkout.title')}</h2>
      </div>

      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-5'>
        {/* Order summary */}
        <div className='space-y-2'>
          {cart.map((item, i) => (
            <div key={`${item.product.id}-${i}`} className='flex items-center justify-between text-sm font-sans'>
              <span className='text-charcoal/80 truncate max-w-[60%]'>
                {item.product.name} ×{item.quantity}
              </span>
              <span className='font-medium text-charcoal shrink-0'>
                {formatPrice(item.product.clientPrice * item.quantity)}
              </span>
            </div>
          ))}
          <div className='flex items-center justify-between pt-2 border-t border-beige font-sans font-bold text-charcoal'>
            <span>{t('store.cart.total')}</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        {/* Shipping form */}
        <div className='space-y-3'>
          <h3 className='text-sm font-sans font-semibold text-charcoal'>{t('store.checkout.shipping')}</h3>

          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>
              {t('store.checkout.name')} <span className='text-red-400'>*</span>
            </label>
            <input type='text' value={shipping.name} onChange={(e) => handleShippingChange('name', e.target.value)} className={inputClass(errors.name)} autoComplete='name' />
            {errors.name && <p className='mt-0.5 text-xs text-red-500 font-sans'>{errors.name}</p>}
          </div>

          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>
              {t('store.checkout.street')} <span className='text-red-400'>*</span>
            </label>
            <input type='text' value={shipping.street} onChange={(e) => handleShippingChange('street', e.target.value)} className={inputClass(errors.street)} autoComplete='address-line1' />
            {errors.street && <p className='mt-0.5 text-xs text-red-500 font-sans'>{errors.street}</p>}
          </div>

          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.apartment')}</label>
            <input type='text' value={shipping.apartment} onChange={(e) => handleShippingChange('apartment', e.target.value)} className={inputClass()} autoComplete='address-line2' />
          </div>

          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>
              {t('store.checkout.city')} <span className='text-red-400'>*</span>
            </label>
            <input type='text' value={shipping.city} onChange={(e) => handleShippingChange('city', e.target.value)} className={inputClass(errors.city)} autoComplete='address-level2' />
            {errors.city && <p className='mt-0.5 text-xs text-red-500 font-sans'>{errors.city}</p>}
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.zip')}</label>
              <input type='text' value={shipping.zip} onChange={(e) => handleShippingChange('zip', e.target.value)} className={inputClass()} autoComplete='postal-code' />
            </div>
            <div>
              <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.country')}</label>
              <input type='text' value={shipping.country} onChange={(e) => handleShippingChange('country', e.target.value)} className={inputClass()} autoComplete='country-name' />
            </div>
          </div>

          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.phone')}</label>
            <input type='tel' value={shipping.phone} onChange={(e) => handleShippingChange('phone', e.target.value)} className={inputClass()} autoComplete='tel' />
          </div>

          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.note')}</label>
            <textarea value={clientNote} onChange={(e) => setClientNote(e.target.value)} rows={2} className='w-full px-3 py-2 text-sm font-sans border border-beige rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors resize-none' />
          </div>
        </div>
      </div>

      <div className='shrink-0 px-4 pb-4 pt-3 border-t border-beige flex gap-3'>
        <button
          type='button'
          onClick={onBack}
          disabled={checkoutMutation.isPending}
          className='h-10 px-4 rounded-lg border border-beige text-sm font-sans text-charcoal hover:bg-ivory transition-colors'
        >
          {t('store.checkout.back')}
        </button>
        <button
          type='button'
          onClick={handlePay}
          disabled={checkoutMutation.isPending}
          className='flex-1 h-10 rounded-lg bg-charcoal text-white text-sm font-sans font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2'
        >
          {checkoutMutation.isPending && (
            <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
          )}
          {t('store.checkout.pay').replace('{amount}', total.toLocaleString('he-IL'))}
        </button>
      </div>
    </div>
  );
}
