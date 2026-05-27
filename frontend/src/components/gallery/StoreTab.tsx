import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { storeCheckout } from '@/lib/api';
import type { StoreProduct, StoreCheckoutRequest } from '@/lib/api';
import type { GalleryImage } from '@/types/gallery';
import { useStoreProducts } from '@/hooks/useQueries';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoreView = 'products' | 'configure' | 'cart' | 'checkout';

interface CartItem {
  product: StoreProduct;
  quantity: number;
  selectedImageIds: string[];
  imageNotes: Record<string, string>;
}

interface StoreTabProps {
  galleryToken: string;
  galleryImages: GalleryImage[];
  getImageUrl: (path: string) => string;
}

interface ShippingFormState {
  name: string;
  street: string;
  apartment: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
}

interface ShippingErrors {
  name?: string;
  street?: string;
  city?: string;
}

// ---------------------------------------------------------------------------
// Helper: format ₪ price
// ---------------------------------------------------------------------------

function formatPrice(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Sub-view: Product card
// ---------------------------------------------------------------------------

interface ProductCardProps {
  product: StoreProduct;
  getImageUrl: (path: string) => string;
  onClick: () => void;
}

function ProductCard({ product, getImageUrl, onClick }: ProductCardProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='group text-start bg-white border border-beige rounded-lg overflow-hidden hover:shadow-md hover:border-charcoal/30 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal'
    >
      <div className='aspect-square bg-ivory overflow-hidden'>
        {product.imagePreviewPath ? (
          <img
            src={getImageUrl(product.imagePreviewPath)}
            alt={product.name}
            loading='lazy'
            className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
          />
        ) : (
          <div className='w-full h-full flex items-center justify-center bg-beige/30'>
            <span className='text-4xl text-charcoal/20'>📷</span>
          </div>
        )}
      </div>
      <div className='p-3 space-y-1'>
        <span className='inline-block text-xs font-sans font-medium bg-ivory border border-beige rounded-full px-2 py-0.5 text-charcoal/60 capitalize'>
          {product.type}
        </span>
        <p className='font-sans font-medium text-sm text-charcoal leading-snug line-clamp-2'>{product.name}</p>
        <p className='font-sans text-sm font-semibold text-charcoal'>{formatPrice(product.clientPrice)}</p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-view: Configure
// ---------------------------------------------------------------------------

interface ConfigureViewProps {
  product: StoreProduct;
  galleryImages: GalleryImage[];
  getImageUrl: (path: string) => string;
  onAdd: (item: CartItem) => void;
  onCancel: () => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

function ConfigureView({ product, galleryImages, getImageUrl, onAdd, onCancel, t, dir }: ConfigureViewProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [imageNotes, setImageNotes] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  function toggleImage(id: string) {
    setSelectedImageIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleNoteExpand(id: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    onAdd({ product, quantity, selectedImageIds, imageNotes });
  }

  const specsEntries = Object.entries(product.specs ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );

  return (
    <div className='flex flex-col flex-1 overflow-hidden' dir={dir}>
      {/* Header */}
      <div className='shrink-0 px-4 pt-4 pb-3 border-b border-beige'>
        <p className='text-xs font-sans text-charcoal/50 uppercase tracking-wide mb-0.5'>{t('store.configure.title')}</p>
        <h2 className='font-serif text-xl text-charcoal'>{product.name}</h2>
        {product.description && (
          <p className='text-sm font-sans text-charcoal/60 mt-1'>{product.description}</p>
        )}
        {specsEntries.length > 0 && (
          <dl className='mt-2 flex flex-wrap gap-x-4 gap-y-1'>
            {specsEntries.map(([k, v]) => (
              <div key={k} className='flex gap-1 text-xs font-sans text-charcoal/60'>
                <dt className='capitalize'>{k}:</dt>
                <dd className='font-medium text-charcoal'>{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-6'>
        {/* Quantity */}
        <div>
          <p className='text-sm font-sans font-medium text-charcoal mb-2'>{t('store.quantity')}</p>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              aria-label='decrease quantity'
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className='w-8 h-8 rounded-full border border-beige text-charcoal flex items-center justify-center hover:bg-ivory transition-colors disabled:opacity-40'
              disabled={quantity <= 1}
            >
              −
            </button>
            <span className='w-8 text-center font-sans font-semibold text-charcoal'>{quantity}</span>
            <button
              type='button'
              aria-label='increase quantity'
              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              className='w-8 h-8 rounded-full border border-beige text-charcoal flex items-center justify-center hover:bg-ivory transition-colors disabled:opacity-40'
              disabled={quantity >= 10}
            >
              +
            </button>
          </div>
        </div>

        {/* Image selection */}
        {galleryImages.length > 0 && (
          <div>
            <p className='text-sm font-sans font-medium text-charcoal mb-1'>{t('store.select_photos')}</p>
            <p className='text-xs font-sans text-charcoal/50 mb-3'>
              {selectedImageIds.length} {t('store.photos_selected')}
            </p>
            <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
              {galleryImages.map((img) => {
                const isSelected = selectedImageIds.includes(img._id);
                const noteExpanded = expandedNotes.has(img._id);
                return (
                  <div key={img._id} className='space-y-1'>
                    <button
                      type='button'
                      onClick={() => toggleImage(img._id)}
                      className={cn(
                        'relative w-full aspect-square rounded overflow-hidden border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal',
                        isSelected ? 'border-charcoal' : 'border-transparent'
                      )}
                      aria-pressed={isSelected}
                      aria-label={img.originalName}
                    >
                      <img
                        src={getImageUrl(img.thumbnailPath ?? img.path)}
                        alt={img.originalName}
                        loading='lazy'
                        className='w-full h-full object-cover'
                      />
                      {isSelected && (
                        <div className='absolute inset-0 bg-charcoal/20 flex items-center justify-center'>
                          <span className='w-5 h-5 rounded-full bg-charcoal flex items-center justify-center'>
                            <svg viewBox='0 0 12 10' fill='none' className='w-3 h-2'>
                              <path d='M1 5l3 3 7-7' stroke='white' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
                            </svg>
                          </span>
                        </div>
                      )}
                    </button>
                    {isSelected && (
                      <div>
                        <button
                          type='button'
                          onClick={() => toggleNoteExpand(img._id)}
                          className='text-xs font-sans text-charcoal/50 hover:text-charcoal transition-colors'
                        >
                          {noteExpanded ? '−' : '+'} הוסף הערה
                        </button>
                        {noteExpanded && (
                          <input
                            type='text'
                            value={imageNotes[img._id] ?? ''}
                            onChange={(e) => setImageNotes((prev) => ({ ...prev, [img._id]: e.target.value }))}
                            placeholder='הערה...'
                            className='mt-1 w-full text-xs font-sans border border-beige rounded px-2 py-1 bg-white focus:outline-none focus:border-charcoal'
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Price summary */}
        <div className='border-t border-beige pt-4 flex items-center justify-between'>
          <span className='text-sm font-sans text-charcoal/60'>{t('store.price')}</span>
          <span className='font-sans font-semibold text-charcoal'>{formatPrice(product.clientPrice * quantity)}</span>
        </div>
      </div>

      {/* Footer actions */}
      <div className='shrink-0 px-4 pb-4 pt-3 border-t border-beige flex gap-3'>
        <button
          type='button'
          onClick={onCancel}
          className='flex-1 h-10 rounded-lg border border-beige text-sm font-sans text-charcoal hover:bg-ivory transition-colors'
        >
          {t('store.configure.cancel')}
        </button>
        <button
          type='button'
          onClick={handleAdd}
          className='flex-1 h-10 rounded-lg bg-charcoal text-white text-sm font-sans font-medium hover:bg-charcoal/90 transition-colors'
        >
          {t('store.configure.add')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-view: Cart
// ---------------------------------------------------------------------------

interface CartViewProps {
  cart: CartItem[];
  onRemove: (index: number) => void;
  onContinueShopping: () => void;
  onCheckout: () => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

function CartView({ cart, onRemove, onContinueShopping, onCheckout, t, dir }: CartViewProps) {
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
                <img
                  src=''
                  alt={item.product.name}
                  className='w-full h-full object-cover'
                />
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
              <p className='font-sans text-sm font-semibold text-charcoal mt-0.5'>
                {formatPrice(item.product.clientPrice * item.quantity)}
              </p>
            </div>
            <button
              type='button'
              onClick={() => onRemove(i)}
              className='text-xs font-sans text-charcoal/40 hover:text-red-500 transition-colors shrink-0 mt-0.5'
              aria-label={`Remove ${item.product.name}`}
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

// ---------------------------------------------------------------------------
// Sub-view: Checkout
// ---------------------------------------------------------------------------

interface CheckoutViewProps {
  cart: CartItem[];
  galleryToken: string;
  onBack: () => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

function CheckoutView({ cart, galleryToken, onBack, t, dir }: CheckoutViewProps) {
  const { toast } = useToast();
  const [shipping, setShipping] = useState<ShippingFormState>({
    name: '',
    street: '',
    apartment: '',
    city: '',
    zip: '',
    country: 'ישראל',
    phone: '',
  });
  const [clientNote, setClientNote] = useState('');
  const [errors, setErrors] = useState<ShippingErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.product.clientPrice * item.quantity, 0);

  const checkoutMutation = useMutation({
    mutationFn: (data: StoreCheckoutRequest) => storeCheckout(galleryToken, data),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'שגיאה בביצוע התשלום. אנא נסה שוב.';
      toast({ title: message, variant: 'destructive' });
    },
  });

  function validate(): ShippingErrors {
    const errs: ShippingErrors = {};
    if (!shipping.name.trim()) errs.name = t('store.checkout.name') + ' ' + 'שדה חובה';
    if (!shipping.street.trim()) errs.street = t('store.checkout.street') + ' ' + 'שדה חובה';
    if (!shipping.city.trim()) errs.city = t('store.checkout.city') + ' ' + 'שדה חובה';
    return errs;
  }

  function handlePay() {
    setSubmitAttempted(true);
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    const items = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selectedImageIds: item.selectedImageIds,
      imageNotes: Object.keys(item.imageNotes).length > 0 ? item.imageNotes : undefined,
    }));

    const shippingAddress = {
      name: shipping.name.trim(),
      street: shipping.street.trim(),
      apartment: shipping.apartment.trim() || undefined,
      city: shipping.city.trim(),
      zip: shipping.zip.trim() || undefined,
      country: shipping.country.trim() || 'ישראל',
      phone: shipping.phone.trim() || undefined,
    };

    checkoutMutation.mutate({ items, shippingAddress, clientNote: clientNote.trim() || undefined });
  }

  function handleShippingChange(field: keyof ShippingFormState, value: string) {
    setShipping((prev) => ({ ...prev, [field]: value }));
    if (submitAttempted) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  const payLabel = t('store.checkout.pay').replace('{amount}', total.toLocaleString('he-IL'));

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

          {/* Name */}
          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>
              {t('store.checkout.name')} <span className='text-red-400'>*</span>
            </label>
            <input
              type='text'
              value={shipping.name}
              onChange={(e) => handleShippingChange('name', e.target.value)}
              className={cn(
                'w-full h-10 px-3 text-sm font-sans border rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors',
                errors.name ? 'border-red-400' : 'border-beige'
              )}
              autoComplete='name'
            />
            {errors.name && <p className='mt-0.5 text-xs text-red-500 font-sans'>{errors.name}</p>}
          </div>

          {/* Street */}
          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>
              {t('store.checkout.street')} <span className='text-red-400'>*</span>
            </label>
            <input
              type='text'
              value={shipping.street}
              onChange={(e) => handleShippingChange('street', e.target.value)}
              className={cn(
                'w-full h-10 px-3 text-sm font-sans border rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors',
                errors.street ? 'border-red-400' : 'border-beige'
              )}
              autoComplete='address-line1'
            />
            {errors.street && <p className='mt-0.5 text-xs text-red-500 font-sans'>{errors.street}</p>}
          </div>

          {/* Apartment */}
          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.apartment')}</label>
            <input
              type='text'
              value={shipping.apartment}
              onChange={(e) => handleShippingChange('apartment', e.target.value)}
              className='w-full h-10 px-3 text-sm font-sans border border-beige rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors'
              autoComplete='address-line2'
            />
          </div>

          {/* City */}
          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>
              {t('store.checkout.city')} <span className='text-red-400'>*</span>
            </label>
            <input
              type='text'
              value={shipping.city}
              onChange={(e) => handleShippingChange('city', e.target.value)}
              className={cn(
                'w-full h-10 px-3 text-sm font-sans border rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors',
                errors.city ? 'border-red-400' : 'border-beige'
              )}
              autoComplete='address-level2'
            />
            {errors.city && <p className='mt-0.5 text-xs text-red-500 font-sans'>{errors.city}</p>}
          </div>

          {/* Zip + Country row */}
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.zip')}</label>
              <input
                type='text'
                value={shipping.zip}
                onChange={(e) => handleShippingChange('zip', e.target.value)}
                className='w-full h-10 px-3 text-sm font-sans border border-beige rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors'
                autoComplete='postal-code'
              />
            </div>
            <div>
              <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.country')}</label>
              <input
                type='text'
                value={shipping.country}
                onChange={(e) => handleShippingChange('country', e.target.value)}
                className='w-full h-10 px-3 text-sm font-sans border border-beige rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors'
                autoComplete='country-name'
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.phone')}</label>
            <input
              type='tel'
              value={shipping.phone}
              onChange={(e) => handleShippingChange('phone', e.target.value)}
              className='w-full h-10 px-3 text-sm font-sans border border-beige rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors'
              autoComplete='tel'
            />
          </div>

          {/* Client note */}
          <div>
            <label className='block text-xs font-sans text-charcoal/60 mb-1'>{t('store.checkout.note')}</label>
            <textarea
              value={clientNote}
              onChange={(e) => setClientNote(e.target.value)}
              rows={2}
              className='w-full px-3 py-2 text-sm font-sans border border-beige rounded-lg bg-white focus:outline-none focus:border-charcoal transition-colors resize-none'
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className='shrink-0 px-4 pb-4 pt-3 border-t border-beige flex gap-3'>
        <button
          type='button'
          onClick={onBack}
          className='h-10 px-4 rounded-lg border border-beige text-sm font-sans text-charcoal hover:bg-ivory transition-colors'
          disabled={checkoutMutation.isPending}
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
          {payLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main StoreTab component
// ---------------------------------------------------------------------------

export const StoreTab = ({ galleryToken, galleryImages, getImageUrl }: StoreTabProps) => {
  const { t, dir } = useI18n();
  const [view, setView] = useState<StoreView>('products');
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const { data: storeData, isLoading } = useStoreProducts(galleryToken);

  function handleSelectProduct(product: StoreProduct) {
    setSelectedProduct(product);
    setView('configure');
  }

  function handleAddToCart(item: CartItem) {
    setCart((prev) => [...prev, item]);
    setView('products');
  }

  function handleRemoveFromCart(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  if (isLoading) {
    return (
      <div className='flex-1 flex items-center justify-center py-16'>
        <div
          className='w-8 h-8 border-2 border-t-transparent rounded-full animate-spin'
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const products = storeData?.products ?? [];

  // Products view
  if (view === 'products') {
    return (
      <div className='flex flex-col flex-1' dir={dir}>
        {/* Toolbar: title + cart badge */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-beige bg-white'>
          <h2 className='font-serif text-lg text-charcoal'>{t('store.title')}</h2>
          {cart.length > 0 && (
            <button
              type='button'
              onClick={() => setView('cart')}
              className='flex items-center gap-2 text-sm font-sans font-medium text-charcoal bg-ivory border border-beige rounded-full px-3 py-1 hover:bg-beige/40 transition-colors'
            >
              <span>🛒</span>
              <span>
                {t('store.cart')} ({cart.length})
              </span>
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <div className='flex-1 flex items-center justify-center py-16'>
            <p className='text-sm font-sans text-charcoal/40'>{t('store.empty')}</p>
          </div>
        ) : (
          <div className='flex-1 overflow-y-auto p-4'>
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  getImageUrl={getImageUrl}
                  onClick={() => handleSelectProduct(product)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Configure view
  if (view === 'configure' && selectedProduct) {
    return (
      <ConfigureView
        product={selectedProduct}
        galleryImages={galleryImages}
        getImageUrl={getImageUrl}
        onAdd={handleAddToCart}
        onCancel={() => setView('products')}
        t={t}
        dir={dir}
      />
    );
  }

  // Cart view
  if (view === 'cart') {
    return (
      <CartView
        cart={cart}
        onRemove={handleRemoveFromCart}
        onContinueShopping={() => setView('products')}
        onCheckout={() => setView('checkout')}
        t={t}
        dir={dir}
      />
    );
  }

  // Checkout view
  if (view === 'checkout') {
    return (
      <CheckoutView
        cart={cart}
        galleryToken={galleryToken}
        onBack={() => setView('cart')}
        t={t}
        dir={dir}
      />
    );
  }

  return null;
};
