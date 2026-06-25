import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { StoreProduct } from '@/lib/api';
import type { GalleryImage } from '@/types/gallery';
import type { CartItem } from './storeTypes';
import { formatPrice } from './storeTypes';

interface Props {
  product: StoreProduct;
  galleryImages: GalleryImage[];
  getImageUrl: (path: string) => string;
  onAdd: (item: CartItem) => void;
  onCancel: () => void;
}

export function StoreConfigureView({ product, galleryImages, getImageUrl, onAdd, onCancel }: Props) {
  const { t, dir } = useI18n();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [imageNotes, setImageNotes] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [productOptions, setProductOptions] = useState<Record<string, string>>({});

  const minPhotos = product.minPhotos ?? 0;
  const maxPhotos = product.maxPhotos ?? 0;
  const variations = product.variations ?? [];
  const atMax = maxPhotos > 0 && selectedImageIds.length >= maxPhotos;
  const countOk = selectedImageIds.length >= minPhotos && (maxPhotos === 0 || selectedImageIds.length <= maxPhotos);
  const optionsOk = variations.every((v) => !!productOptions[v.name]);
  const canAdd = countOk && optionsOk;

  const requirementText =
    minPhotos > 0 && maxPhotos > 0
      ? t('store.photos_requirement').replace('{min}', String(minPhotos)).replace('{max}', String(maxPhotos))
      : minPhotos > 0
      ? t('store.photos_min_only').replace('{min}', String(minPhotos))
      : maxPhotos > 0
      ? t('store.photos_max_only').replace('{max}', String(maxPhotos))
      : null;

  function toggleImage(id: string) {
    setSelectedImageIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (maxPhotos > 0 && prev.length >= maxPhotos) return prev; // block past max
      return [...prev, id];
    });
  }

  function toggleNoteExpand(id: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
        {product.productionDays != null && (
          <p className='text-xs font-sans text-charcoal/50 mt-1.5'>
            {t('store.production_days').replace('{n}', String(product.productionDays))}
          </p>
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
              disabled={quantity <= 1}
              className='w-8 h-8 rounded-full border border-beige text-charcoal flex items-center justify-center hover:bg-ivory transition-colors disabled:opacity-40'
            >
              −
            </button>
            <span className='w-8 text-center font-sans font-semibold text-charcoal'>{quantity}</span>
            <button
              type='button'
              aria-label='increase quantity'
              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              disabled={quantity >= 10}
              className='w-8 h-8 rounded-full border border-beige text-charcoal flex items-center justify-center hover:bg-ivory transition-colors disabled:opacity-40'
            >
              +
            </button>
          </div>
        </div>

        {/* Variations */}
        {variations.length > 0 && (
          <div className='space-y-3'>
            {variations.map((variation) => (
              <div key={variation.name}>
                <p className='text-sm font-sans font-medium text-charcoal mb-2'>{variation.name}</p>
                <div className='flex flex-wrap gap-2'>
                  {variation.options.map((opt) => {
                    const active = productOptions[variation.name] === opt;
                    return (
                      <button
                        key={opt}
                        type='button'
                        aria-pressed={active}
                        onClick={() => setProductOptions((prev) => ({ ...prev, [variation.name]: opt }))}
                        className={cn(
                          'px-3 py-1.5 rounded-full border text-xs font-sans transition-colors',
                          active
                            ? 'border-charcoal bg-charcoal text-white'
                            : 'border-beige text-charcoal hover:border-charcoal'
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Image selection */}
        {galleryImages.length > 0 && (
          <div>
            <p className='text-sm font-sans font-medium text-charcoal mb-1'>{t('store.select_photos')}</p>
            <p className={cn(
              'text-xs font-sans mb-3',
              requirementText && !countOk ? 'text-[var(--flag-ink)] font-medium' : 'text-charcoal/50'
            )}>
              {selectedImageIds.length} {t('store.photos_selected')}
              {requirementText ? ` · ${requirementText}` : ''}
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
                      aria-pressed={isSelected}
                      aria-label={img.originalName}
                      disabled={!isSelected && atMax}
                      className={cn(
                        'relative w-full aspect-square rounded overflow-hidden border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal',
                        isSelected ? 'border-charcoal' : 'border-transparent',
                        !isSelected && atMax && 'opacity-40 cursor-not-allowed'
                      )}
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

      {/* Footer */}
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
          disabled={!canAdd}
          onClick={() => onAdd({ product, quantity, selectedImageIds, imageNotes, productOptions })}
          className='flex-1 h-10 rounded-lg bg-charcoal text-white text-sm font-sans font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
        >
          {t('store.configure.add')}
        </button>
      </div>
    </div>
  );
}
