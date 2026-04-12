import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Send, ShoppingBag, Package } from 'lucide-react';
import Masonry from 'react-masonry-css';
import api from '@/lib/api';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import {
  fetchProductOrdersByToken,
  submitProductOrderSelection,
  type ProductOrder,
  type SelectedPhoto,
} from '@/services/productOrderService';
import type { GalleryImage } from '@/types/gallery';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GalleryTab {
  _id: string;
  name: string;
  isDelivery: boolean;
}

interface ImageWithGallery extends GalleryImage {
  galleryId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getImageUrl = (path: string) => `${API_BASE}${path}`;

// ── OrderPanel ────────────────────────────────────────────────────────────────

interface OrderPanelProps {
  order: ProductOrder;
  onSubmitted: (orderId: string) => void;
}

const OrderPanel = ({ order, onSubmitted }: OrderPanelProps) => {
  const galleries = order.allowedGalleryIds as GalleryTab[];

  const [activeGalleryId, setActiveGalleryId] = useState<string | null>(
    galleries.length > 0 ? null : null, // null = "All"
  );
  const [allImages, setAllImages] = useState<ImageWithGallery[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<string, SelectedPhoto>>(
    () => new Map(order.status === 'submitted' ? order.selectedPhotoIds.map((p) => [p.imageId, p]) : []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(order.status === 'submitted');
  const [maxReachedFlash, setMaxReachedFlash] = useState(false);

  const atMax = selectedPhotos.size >= order.maxPhotos;

  // Load images from all allowed galleries in parallel on mount
  useEffect(() => {
    if (galleries.length === 0) {
      setImagesLoading(false);
      return;
    }
    (async () => {
      setImagesLoading(true);
      try {
        const results = await Promise.all(
          galleries.map((g) =>
            api.get<GalleryImage[]>(`/galleries/${g._id}/images`).then((r) => r.data.map((img) => ({ ...img, galleryId: g._id }))),
          ),
        );
        // Merge and deduplicate by _id
        const seen = new Set<string>();
        const merged: ImageWithGallery[] = [];
        for (const batch of results) {
          for (const img of batch) {
            if (!seen.has(img._id)) {
              seen.add(img._id);
              merged.push(img);
            }
          }
        }
        setAllImages(merged);
      } catch {
        setAllImages([]);
      } finally {
        setImagesLoading(false);
      }
    })();
  }, [order._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleImages = activeGalleryId === null ? allImages : allImages.filter((img) => img.galleryId === activeGalleryId);

  const togglePhoto = useCallback(
    (img: ImageWithGallery) => {
      setSelectedPhotos((prev) => {
        const next = new Map(prev);
        if (next.has(img._id)) {
          next.delete(img._id);
          return next;
        }
        if (next.size >= order.maxPhotos) {
          // Flash the max indicator
          setMaxReachedFlash(true);
          setTimeout(() => setMaxReachedFlash(false), 1200);
          return prev;
        }
        next.set(img._id, {
          galleryId: img.galleryId,
          imageId: img._id,
          path: img.path,
          thumbnailPath: img.thumbnailPath,
          filename: img.filename,
        });
        return next;
      });
    },
    [order.maxPhotos],
  );

  const handleSubmit = async () => {
    if (selectedPhotos.size === 0) return;
    setSubmitting(true);
    try {
      await submitProductOrderSelection(order._id, Array.from(selectedPhotos.values()));
      setSubmitted(true);
      onSubmitted(order._id);
    } catch {
      // leave submitting=false so user can retry
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = order.type === 'album' ? 'Album' : 'Print';
  const typeBadgeClass =
    order.type === 'album' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-amber-50 text-amber-700 border-amber-200';

  // ── Submitted state ──────────────────────────────────────────────────────────

  if (submitted) {
    const submittedPhotos = Array.from(selectedPhotos.values());
    return (
      <FadeIn>
        <div className='border border-beige rounded-2xl overflow-hidden'>
          {/* Header */}
          <div className='px-5 py-4 bg-ivory border-b border-beige flex items-center gap-3 flex-wrap'>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 flex-wrap'>
                <h3 className=' text-base text-charcoal'>{order.name}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${typeBadgeClass}`}>{typeLabel}</span>
                <span className='text-[11px] px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 flex items-center gap-1'>
                  <Check size={10} />
                  Submitted
                </span>
              </div>
              <p className='text-xs text-warm-gray mt-0.5'>
                {submittedPhotos.length} photo{submittedPhotos.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>

          {/* Submitted photo strip */}
          {submittedPhotos.length > 0 && (
            <div className='p-4'>
              <div className='grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2'>
                {submittedPhotos.map((photo) => (
                  <div
                    key={photo.imageId}
                    className='relative aspect-square rounded-lg overflow-hidden ring-2'
                    style={{ boxShadow: '0 0 0 2px #E7B8B5' }}
                  >
                    <img
                      src={getImageUrl(photo.thumbnailPath || photo.path)}
                      alt={photo.filename}
                      className='w-full h-full object-cover'
                      loading='lazy'
                    />
                    <div
                      className='absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center'
                      style={{ backgroundColor: '#E7B8B5' }}
                    >
                      <Check size={10} className='text-white' />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </FadeIn>
    );
  }

  // ── Active selection state ───────────────────────────────────────────────────

  return (
    <FadeIn>
      <div className='border border-beige rounded-2xl overflow-hidden'>
        {/* Order header + sticky submit bar */}
        <div className='sticky top-0 z-10 px-5 py-4 bg-ivory border-b border-beige'>
          <div className='flex items-start justify-between gap-3 flex-wrap'>
            <div className='min-w-0'>
              <div className='flex items-center gap-2 flex-wrap'>
                <h3 className=' text-base text-charcoal'>{order.name}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${typeBadgeClass}`}>{typeLabel}</span>
              </div>
              <p className='text-xs text-warm-gray mt-0.5'>
                Select up to {order.maxPhotos} photo{order.maxPhotos !== 1 ? 's' : ''}
              </p>
            </div>

            <div className='flex items-center gap-3 shrink-0'>
              <span
                className={`text-sm font-medium transition-colors duration-300 ${
                  maxReachedFlash ? 'text-blush scale-105' : atMax ? 'text-blush' : 'text-warm-gray'
                }`}
              >
                {selectedPhotos.size} / {order.maxPhotos}
                {atMax && <span className='ms-2 text-xs font-normal'>— max reached</span>}
              </span>

              <button
                onClick={handleSubmit}
                disabled={submitting || selectedPhotos.size === 0}
                className='flex items-center gap-2 px-4 py-2 bg-blush text-white text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50'
              >
                <Send size={13} />
                {submitting ? 'Submitting…' : 'Submit Selection'}
              </button>
            </div>
          </div>

          {/* Gallery filter tabs */}
          {galleries.length > 1 && (
            <div className='flex gap-1.5 mt-3 flex-wrap'>
              <button
                onClick={() => setActiveGalleryId(null)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  activeGalleryId === null
                    ? 'bg-blush text-white border-blush'
                    : 'bg-white text-warm-gray border-beige hover:border-blush hover:text-charcoal'
                }`}
              >
                All ({allImages.length})
              </button>
              {galleries.map((g) => {
                const count = allImages.filter((img) => img.galleryId === g._id).length;
                return (
                  <button
                    key={g._id}
                    onClick={() => setActiveGalleryId(g._id)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      activeGalleryId === g._id
                        ? 'bg-blush text-white border-blush'
                        : 'bg-white text-warm-gray border-beige hover:border-blush hover:text-charcoal'
                    }`}
                  >
                    {g.name} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Image grid */}
        <div className='p-4'>
          {imagesLoading ? (
            <div className='flex items-center justify-center py-16 gap-3'>
              <div className='w-5 h-5 border-2 border-blush border-t-transparent rounded-full animate-spin' />
              <p className='text-sm text-warm-gray'>Loading photos…</p>
            </div>
          ) : visibleImages.length === 0 ? (
            <p className='text-center text-sm text-warm-gray py-12'>No photos available.</p>
          ) : (
            <Masonry breakpointCols={{ default: 4, 1024: 3, 640: 2 }} className='masonry-grid' columnClassName='masonry-grid_column'>
              {visibleImages.map((img, i) => {
                const isSelected = selectedPhotos.has(img._id);
                const isBlocked = !isSelected && atMax;
                return (
                  <FadeIn key={img._id} delay={Math.min(i * 0.015, 0.2)}>
                    <div
                      onClick={() => {
                        if (!isBlocked) togglePhoto(img);
                      }}
                      className={`group relative rounded-xl overflow-hidden transition-all duration-200 mb-3 ${
                        isBlocked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                      }`}
                      style={isSelected ? { boxShadow: '0 0 0 3px #E7B8B5' } : {}}
                    >
                      <img
                        src={getImageUrl(img.thumbnailPath || img.path)}
                        alt={img.originalName || img.filename}
                        className='w-full h-auto block'
                        loading='lazy'
                      />

                      {/* Hover overlay */}
                      {!isBlocked && (
                        <div className='absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-200 pointer-events-none' />
                      )}

                      {/* Selected check badge */}
                      {isSelected ? (
                        <div
                          className='absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm'
                          style={{ backgroundColor: '#E7B8B5' }}
                        >
                          <Check size={13} className='text-white' />
                        </div>
                      ) : !isBlocked ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePhoto(img);
                          }}
                          className='absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                          aria-label='Select photo'
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
    </FadeIn>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────────

export const ClientProductsPage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useI18n();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [clientName, setClientName] = useState<string>('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await fetchProductOrdersByToken(token);
        setOrders(data);
        // Derive client name from first gallery's context if available
        if (data.length > 0) {
          const firstGalleries = data[0].allowedGalleryIds as { _id: string; name: string }[];
          if (firstGalleries.length > 0) {
            // Try to get client name from the gallery token endpoint
            try {
              const gRes = await api.get(`/galleries/token/${token}`);
              setClientName(gRes.data.clientName || '');
            } catch {
              // optional — silently ignore
            }
          }
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmitted = (orderId: string) => {
    setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, status: 'submitted' as const } : o)));
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className='min-h-screen flex items-center justify-center' style={{ backgroundColor: '#FAF8F4' }}>
        <div className='flex flex-col items-center gap-4'>
          <div
            className='w-8 h-8 border-2 border-t-transparent rounded-full animate-spin'
            style={{ borderColor: '#E7B8B5', borderTopColor: 'transparent' }}
          />
          <p className='text-sm text-warm-gray'>Loading your products…</p>
        </div>
      </main>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <main className='min-h-screen flex items-center justify-center px-6' style={{ backgroundColor: '#FAF8F4' }}>
        <FadeIn>
          <div className='text-center'>
            <Package size={40} className='mx-auto mb-4 text-beige' />
            <p className=' text-2xl text-charcoal mb-2'>Link not found</p>
            <p className='text-sm text-warm-gray'>This link may have expired or is invalid. Please contact your photographer.</p>
          </div>
        </FadeIn>
      </main>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (orders.length === 0) {
    return (
      <main className='min-h-screen flex items-center justify-center px-6' style={{ backgroundColor: '#FAF8F4' }}>
        <FadeIn>
          <div className='text-center'>
            <ShoppingBag size={40} className='mx-auto mb-4 text-beige' />
            <p className=' text-2xl text-charcoal mb-2'>{t('products.no_products_title')}</p>
            <p className='text-sm text-warm-gray'>{t('products.no_products_desc')}</p>
          </div>
        </FadeIn>
      </main>
    );
  }

  // ── Content ────────────────────────────────────────────────────────────────

  const allSubmitted = orders.every((o) => o.status === 'submitted');

  return (
    <main className='min-h-screen' style={{ backgroundColor: '#FAF8F4' }}>
      {/* Page header */}
      <header className='border-b border-beige bg-white/70 backdrop-blur-sm sticky top-0 z-20'>
        <div className='max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3'>
          <div className='w-8 h-8 rounded-full flex items-center justify-center shrink-0' style={{ backgroundColor: '#E7B8B5' }}>
            <ShoppingBag size={15} className='text-white' />
          </div>
          <div className='min-w-0'>
            <h1 className=' text-lg text-charcoal leading-tight'>Your Products</h1>
            {clientName && <p className='text-xs text-warm-gray truncate'>{clientName}</p>}
          </div>
          {allSubmitted && (
            <span className='ms-auto text-xs flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full'>
              <Check size={11} />
              All submitted
            </span>
          )}
        </div>
      </header>

      {/* Orders */}
      <div className='max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8'>
        {orders.map((order, i) => (
          <FadeIn key={order._id} delay={i * 0.08}>
            <OrderPanel order={order} onSubmitted={handleSubmitted} />
          </FadeIn>
        ))}
      </div>

      {/* Footer */}
      <footer className='text-center py-8 mt-4'>
        <p className='text-xs text-warm-gray/60'>Koral Light Studio</p>
      </footer>
    </main>
  );
};
