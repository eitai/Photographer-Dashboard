import { useCallback, useEffect, useState } from 'react';
import { Check, Send, ShoppingBag } from 'lucide-react';
import Masonry from 'react-masonry-css';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { FadeIn } from '@/components/FadeIn';
import { submitProductOrderSelection, type ProductOrder, type SelectedPhoto } from '@/services/productOrderService';
import type { GalleryImage } from '@/types/gallery';

interface Props {
  orders: ProductOrder[];
  getImageUrl: (path: string) => string;
}

interface GalleryTab {
  _id: string;
  name: string;
  isDelivery: boolean;
}

interface OrderPanelProps {
  order: ProductOrder;
  getImageUrl: (path: string) => string;
  onSubmitted: (orderId: string) => void;
}

const OrderPanel = ({ order, getImageUrl, onSubmitted }: OrderPanelProps) => {
  const { t } = useI18n();

  const galleries = order.allowedGalleryIds as GalleryTab[];
  const [activeGalleryId, setActiveGalleryId] = useState<string>(galleries[0]?._id ?? '');
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<string, SelectedPhoto>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(order.status === 'submitted');

  const atMax = selectedPhotos.size >= order.maxPhotos;

  const loadImages = useCallback(async (galleryId: string) => {
    if (!galleryId) return;
    setImagesLoading(true);
    try {
      const res = await api.get(`/galleries/${galleryId}/images`);
      setImages(res.data);
    } catch {
      setImages([]);
    } finally {
      setImagesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages(activeGalleryId);
  }, [activeGalleryId, loadImages]);

  const togglePhoto = (img: GalleryImage, galleryId: string) => {
    setSelectedPhotos((prev) => {
      const next = new Map(prev);
      if (next.has(img._id)) {
        next.delete(img._id);
      } else {
        if (next.size >= order.maxPhotos) return prev;
        next.set(img._id, {
          galleryId,
          imageId: img._id,
          path: img.path,
          thumbnailPath: img.thumbnailPath,
          filename: img.filename,
        });
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedPhotos.size === 0) return;
    setSubmitting(true);
    try {
      await submitProductOrderSelection(order._id, Array.from(selectedPhotos.values()));
      setSubmitted(true);
      onSubmitted(order._id);
    } catch {
      // leave submitting=false so the user can retry
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = order.type === 'album' ? t('products.album') : t('products.print');

  if (submitted) {
    return (
      <div className='border border-beige rounded-2xl p-5 bg-ivory text-center space-y-2'>
        <div className='flex items-center justify-center gap-2 text-green-700'>
          <Check size={16} />
          <span className='text-sm font-medium'>{t('products.submitted')}</span>
        </div>
        <p className='text-xs text-warm-gray'>
          {order.name} · {typeLabel}
        </p>
      </div>
    );
  }

  return (
    <div className='border border-beige rounded-2xl overflow-hidden'>
      {/* Order header */}
      <div className='px-5 py-4 bg-ivory border-b border-beige flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h3 className=' text-base text-charcoal'>{order.name}</h3>
          <p className='text-xs text-warm-gray mt-0.5'>
            {typeLabel} · {order.maxPhotos} {t('products.max_label')}
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <span className={`text-sm font-medium ${atMax ? 'text-blush' : 'text-warm-gray'}`}>
            {selectedPhotos.size} {t('products.selected_of')} {order.maxPhotos}
            {atMax && <span className='ms-2 text-xs'>— {t('products.max_reached')}</span>}
          </span>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedPhotos.size === 0}
            className='flex items-center gap-2 px-4 py-2 bg-blush text-white text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50'
          >
            <Send size={13} />
            {submitting ? t('products.submitting') : t('products.submit')}
          </button>
        </div>
      </div>

      {/* Gallery tabs */}
      {galleries.length > 1 && (
        <div className='flex gap-1 px-5 pt-3 flex-wrap'>
          {galleries.map((g) => (
            <button
              key={g._id}
              onClick={() => setActiveGalleryId(g._id)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                activeGalleryId === g._id
                  ? 'bg-blush text-white border-blush'
                  : 'bg-white text-warm-gray border-beige hover:border-blush hover:text-charcoal'
              }`}
            >
              {g.name}
              {g.isDelivery && <span className='ms-1.5 opacity-70'>·</span>}
            </button>
          ))}
        </div>
      )}

      {/* Image grid */}
      <div className='p-4'>
        {imagesLoading ? (
          <p className='text-center text-sm text-warm-gray py-8'>{t('products.loading')}</p>
        ) : images.length === 0 ? (
          <p className='text-center text-sm text-warm-gray py-8'>{t('products.no_images')}</p>
        ) : (
          <Masonry breakpointCols={{ default: 4, 1024: 3, 640: 2 }} className='masonry-grid' columnClassName='masonry-grid_column'>
            {images.map((img, i) => {
              const isSelected = selectedPhotos.has(img._id);
              const isBlocked = !isSelected && atMax;
              return (
                <FadeIn key={img._id} delay={Math.min(i * 0.02, 0.25)}>
                  <div
                    onClick={() => {
                      if (!isBlocked) togglePhoto(img, activeGalleryId);
                    }}
                    className={`group relative rounded-xl overflow-hidden transition-shadow duration-200 mb-3 ${
                      isSelected ? 'ring-4' : ''
                    } ${isBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    style={isSelected ? { boxShadow: '0 0 0 3px #E7B8B5' } : {}}
                  >
                    <img
                      src={getImageUrl(img.thumbnailPath || img.path)}
                      alt={img.originalName || img.filename}
                      className='w-full h-auto block'
                      loading='lazy'
                    />

                    {!isBlocked && (
                      <div className='absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-200 pointer-events-none' />
                    )}

                    {isSelected ? (
                      <div
                        className='absolute top-2 end-2 w-7 h-7 rounded-full flex items-center justify-center text-charcoal'
                        style={{ backgroundColor: '#E7B8B5' }}
                      >
                        <Check size={13} />
                      </div>
                    ) : !isBlocked ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePhoto(img, activeGalleryId);
                        }}
                        className='absolute top-2 end-2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                        aria-label={t('gallery.select_photo')}
                      >
                        <Check size={13} />
                      </button>
                    ) : null}
                  </div>
                </FadeIn>
              );
            })}
          </Masonry>
        )}
      </div>
    </div>
  );
};

// ── Top-level section ─────────────────────────────────────────────────────────

export const ProductOrdersClient = ({ orders, getImageUrl }: Props) => {
  const { t } = useI18n();
  const [localOrders, setLocalOrders] = useState(orders);

  // Keep in sync if parent re-fetches
  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  const handleSubmitted = (orderId: string) => {
    setLocalOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, status: 'submitted' } : o)));
  };

  const pendingOrders = localOrders.filter((o) => o.allowedGalleryIds.length > 0);
  if (pendingOrders.length === 0) return null;

  return (
    <section className='section-spacing border-t border-border mt-8 pt-8'>
      <div className='container-narrow'>
        <FadeIn>
          <div className='flex items-center gap-2 mb-6'>
            <ShoppingBag size={20} className='text-blush' />
            <h2 className=' text-2xl text-foreground'>{t('products.section_title')}</h2>
          </div>
        </FadeIn>

        <div className='space-y-6'>
          {pendingOrders.map((order) => (
            <FadeIn key={order._id}>
              <OrderPanel order={order} getImageUrl={getImageUrl} onSubmitted={handleSubmitted} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};
