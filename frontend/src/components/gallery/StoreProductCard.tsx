import type { StoreProduct } from '@/lib/api';
import { formatPrice } from './storeTypes';

interface Props {
  product: StoreProduct;
  getImageUrl: (path: string) => string;
  onClick: () => void;
}

export function StoreProductCard({ product, getImageUrl, onClick }: Props) {
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
