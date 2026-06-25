import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useStoreProducts } from '@/hooks/useQueries';
import type { GalleryImage } from '@/types/gallery';
import type { StoreView, CartItem } from './storeTypes';
import { StoreProductCard } from './StoreProductCard';
import { StoreConfigureView } from './StoreConfigureView';
import { StoreCartView } from './StoreCartView';
import { StoreCheckoutView } from './StoreCheckoutView';
import type { StoreProduct } from '@/lib/api';

interface Props {
  galleryToken: string;
  galleryImages: GalleryImage[];
  getImageUrl: (path: string) => string;
}

export const StoreTab = ({ galleryToken, galleryImages, getImageUrl }: Props) => {
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

  if (view === 'configure' && selectedProduct) {
    return (
      <StoreConfigureView
        product={selectedProduct}
        galleryImages={galleryImages}
        getImageUrl={getImageUrl}
        onAdd={handleAddToCart}
        onCancel={() => setView('products')}
      />
    );
  }

  if (view === 'cart') {
    return (
      <StoreCartView
        cart={cart}
        onRemove={handleRemoveFromCart}
        onContinueShopping={() => setView('products')}
        onCheckout={() => setView('checkout')}
      />
    );
  }

  if (view === 'checkout') {
    return (
      <StoreCheckoutView
        cart={cart}
        galleryToken={galleryToken}
        onBack={() => setView('cart')}
      />
    );
  }

  // Products view (default)
  return (
    <div className='flex flex-col flex-1' dir={dir}>
      <div className='flex items-center justify-between px-4 py-3 border-b border-beige bg-white'>
        <h2 className='font-serif text-lg text-charcoal'>{t('store.title')}</h2>
        {cart.length > 0 && (
          <button
            type='button'
            onClick={() => setView('cart')}
            className='flex items-center gap-2 text-sm font-sans font-medium text-charcoal bg-ivory border border-beige rounded-full px-3 py-1 hover:bg-beige/40 transition-colors'
          >
            <span>🛒</span>
            <span>{t('store.cart')} ({cart.length})</span>
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
              <StoreProductCard
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
};
