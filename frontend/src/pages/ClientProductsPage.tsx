import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Send, ShoppingBag, Package, ChevronDown } from 'lucide-react';
import Masonry from 'react-masonry-css';
import api, { getImageUrl } from '@/lib/api';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import {
  fetchProductOrdersByToken,
  submitProductOrderSelection,
  type ProductOrder,
  type SelectedPhoto,
} from '@/services/productOrderService';
import type { GalleryImage } from '@/types/gallery';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GalleryTab {
  _id?: string;
  id?: string;
  name: string;
  isDelivery: boolean;
}

interface ImageWithGallery extends GalleryImage {
  galleryId: string;
}

// ── OrderPanel ────────────────────────────────────────────────────────────────

export interface OrderPanelProps {
  order: ProductOrder;
  onSubmitted: (orderId: string) => void;
  /** Offset for the sticky submit bar — should match the page header height */
  stickyTop?: string;
}

export const OrderPanel = ({ order, onSubmitted, stickyTop = 'top-16' }: OrderPanelProps) => {
  const { t, dir } = useI18n();
  const galleries = order.allowedGalleryIds as GalleryTab[];

  const [activeGalleryId, setActiveGalleryId] = useState<string | null>(null);
  const [allImages, setAllImages] = useState<ImageWithGallery[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<Map<string, SelectedPhoto>>(
    () => new Map(order.status === 'submitted' ? order.selectedPhotoIds.map((p) => [p.imageId, p]) : []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(order.status === 'submitted');
  const [maxReachedFlash, setMaxReachedFlash] = useState(false);

  const atMax = selectedPhotos.size >= order.maxPhotos;

  useEffect(() => {
    if (galleries.length === 0) { setImagesLoading(false); return; }
    (async () => {
      setImagesLoading(true);
      try {
        const results = await Promise.all(
          galleries.map((g) => {
            const gid = (g as GalleryTab & { id?: string })._id || (g as GalleryTab & { id?: string }).id || '';
            return api
              .get<GalleryImage[] | { images: GalleryImage[] }>(`/galleries/${gid}/images?limit=300`)
              .then((r) => {
                const imgs = Array.isArray(r.data) ? r.data : (r.data as { images: GalleryImage[] }).images;
                return imgs.map((img) => ({ ...img, galleryId: gid }));
              });
          }),
        );
        const seen = new Set<string>();
        const merged: ImageWithGallery[] = [];
        for (const batch of results) {
          for (const img of batch) {
            if (!seen.has(img._id)) { seen.add(img._id); merged.push(img); }
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

  const visibleImages = useMemo(
    () => activeGalleryId === null ? allImages : allImages.filter((img) => img.galleryId === activeGalleryId),
    [allImages, activeGalleryId],
  );

  const getGid = (g: GalleryTab) => g._id || (g as GalleryTab & { id?: string }).id || '';

  const galleryCounts = useMemo(
    () => Object.fromEntries(galleries.map((g) => { const gid = getGid(g); return [gid, allImages.filter((img) => img.galleryId === gid).length]; })),
    [allImages, galleries],
  );

  const togglePhoto = useCallback(
    (img: ImageWithGallery) => {
      setSelectedPhotos((prev) => {
        const next = new Map(prev);
        if (next.has(img._id)) { next.delete(img._id); return next; }
        if (next.size >= order.maxPhotos) {
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

  const typeLabel = order.type === 'album' ? t('products.album') : t('products.print');

  // ── Submitted state ──────────────────────────────────────────────────────────

  if (submitted) {
    const submittedPhotos = Array.from(selectedPhotos.values());

    const supplierBanner: Record<string, { label: string; cls: string }> = {
      in_production: { label: dir === 'rtl' ? '🎨 ההזמנה שלך בייצור' : '🎨 Your order is in production',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
      shipped:       { label: dir === 'rtl' ? '📦 ההזמנה שלך נשלחה' : '📦 Your order has shipped',           cls: 'bg-sky-50 text-sky-700 border-sky-200' },
      delivered:     { label: dir === 'rtl' ? '✅ ההזמנה שלך נמסרה' : '✅ Your order has been delivered',    cls: 'bg-green-50 text-green-700 border-green-200' },
    };
    const banner = order.supplierStatus ? supplierBanner[order.supplierStatus] : null;

    return (
      <FadeIn>
        <div className='bg-card border border-border rounded-2xl'>
          {banner && (
            <div className={`px-5 py-3 border-b text-sm font-medium rounded-t-2xl ${banner.cls}`}>
              {banner.label}
              {order.supplierStatus === 'shipped' && order.trackingNumber && (
                <span className='ms-2 font-normal opacity-80'>
                  {order.trackingCarrier ? `${order.trackingCarrier} — ` : ''}{order.trackingNumber}
                </span>
              )}
            </div>
          )}
          <div className={`px-5 py-4 bg-muted/40 border-b border-border ${!banner ? 'rounded-t-2xl' : ''}`}>
            <div className='flex items-center gap-2 flex-wrap'>
              <h3 className='text-base font-semibold text-foreground'>{order.name}</h3>
              <span className='text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground'>{typeLabel}</span>
              <span className='text-[11px] px-2.5 py-0.5 rounded-full bg-foreground text-background flex items-center gap-1'>
                <Check size={10} />
                {t('products.submitted')}
              </span>
            </div>
            <p className='text-xs text-muted-foreground mt-1'>
              {submittedPhotos.length} {t('products.selected_of')} {order.maxPhotos}
            </p>
          </div>

          {submittedPhotos.length > 0 && (
            <div className='p-4'>
              <div className='grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2'>
                {submittedPhotos.map((photo) => (
                  <div key={photo.imageId} className='relative aspect-square rounded-lg overflow-hidden ring-2 ring-foreground'>
                    <img
                      src={getImageUrl(photo.thumbnailPath || photo.path)}
                      alt={photo.filename}
                      className='w-full h-full object-cover'
                      loading='lazy'
                    />
                    <div className='absolute top-1 end-1 w-5 h-5 rounded-full bg-foreground flex items-center justify-center'>
                      <Check size={10} className='text-background' />
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
      <div className='bg-card border border-border rounded-2xl'>

        {/* Sticky submit bar */}
        <div className={`sticky ${stickyTop} z-10 px-5 py-3 bg-card border-b border-border rounded-t-2xl`}>
          <div className='flex items-center justify-between gap-3 flex-wrap'>
            <div className='min-w-0 flex items-center gap-2 flex-wrap'>
              <h3 className='text-sm font-semibold text-foreground'>{order.name}</h3>
              <span className='text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground'>{typeLabel}</span>
              <span className={`text-xs transition-colors duration-300 ${maxReachedFlash ? 'text-red-500 font-semibold' : atMax ? 'text-red-500' : 'text-muted-foreground'}`}>
                {selectedPhotos.size} / {order.maxPhotos} {t('products.max_label')}
                {atMax && <span className='ms-1.5 font-normal'>— {t('products.max_reached')}</span>}
              </span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || selectedPhotos.size === 0}
              className='flex items-center gap-2 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/80 transition-opacity disabled:opacity-40 cursor-pointer shrink-0'
            >
              <Send size={13} className={dir === 'rtl' ? 'rotate-180' : ''} />
              {submitting ? t('products.submitting') : t('products.submit')}
            </button>
          </div>

          {/* Gallery filter tabs */}
          {galleries.length > 1 && (
            <div className='flex gap-1.5 mt-2.5 flex-wrap'>
              <button
                onClick={() => setActiveGalleryId(null)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  activeGalleryId === null
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
                }`}
              >
                {t('products.choose_gallery') === 'Choose a gallery to browse' ? 'All' : 'הכל'} ({allImages.length})
              </button>
              {galleries.map((g) => {
                const gid = getGid(g);
                const count = galleryCounts[gid] ?? 0;
                return (
                  <button
                    key={gid}
                    onClick={() => setActiveGalleryId(gid)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      activeGalleryId === gid
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
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
            <div className='flex items-center justify-center py-20 gap-3'>
              <div className='w-5 h-5 border-2 border-border border-t-foreground rounded-full animate-spin' />
              <p className='text-sm text-muted-foreground'>{t('products.loading')}</p>
            </div>
          ) : visibleImages.length === 0 ? (
            <p className='text-center text-sm text-muted-foreground py-16'>{t('products.no_images')}</p>
          ) : (
            <Masonry
              breakpointCols={{ default: 4, 1024: 3, 640: 2 }}
              className='masonry-grid'
              columnClassName='masonry-grid_column'
            >
              {visibleImages.map((img) => {
                const isSelected = selectedPhotos.has(img._id);
                const isBlocked = !isSelected && atMax;
                return (
                  <div key={img._id} className='mb-3'>
                    <div
                      onClick={() => { if (!isBlocked) togglePhoto(img); }}
                      className={`group relative rounded-xl overflow-hidden transition-all duration-200 ${
                        isBlocked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                      } ${isSelected ? 'ring-2 ring-foreground ring-offset-1' : ''}`}
                    >
                      <img
                        src={getImageUrl(img.thumbnailPath || img.path)}
                        alt={img.originalName || img.filename}
                        className='w-full h-auto block'
                        loading='lazy'
                      />
                      {!isBlocked && (
                        <div className='absolute inset-0 bg-foreground/0 group-hover:bg-foreground/[0.06] transition-colors duration-200 pointer-events-none' />
                      )}
                      {isSelected ? (
                        <div className='absolute top-2 end-2 w-7 h-7 rounded-full bg-foreground flex items-center justify-center shadow-sm'>
                          <Check size={13} className='text-background' />
                        </div>
                      ) : !isBlocked ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePhoto(img); }}
                          className='absolute top-2 end-2 w-7 h-7 rounded-full bg-background/80 border border-border text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                          aria-label={t('products.pick_photos')}
                        >
                          <Check size={13} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </Masonry>
          )}
        </div>
      </div>
    </FadeIn>
  );
};

// ── PreviousOrderRow ──────────────────────────────────────────────────────────
// Compact, expandable row for an already-submitted order. Collapsed it shows
// just name + status; expanded it reveals the chosen photos and tracking.

const PreviousOrderRow = ({ order }: { order: ProductOrder }) => {
  const { t, dir } = useI18n();
  const [open, setOpen] = useState(false);

  const typeLabel = order.type === 'album' ? t('products.album') : t('products.print');
  const statusLabel = order.supplierStatus
    ? t(`orders.status.${order.supplierStatus}`)
    : t('products.submitted');
  const photos = order.selectedPhotoIds ?? [];

  return (
    <div className='bg-card border border-border rounded-2xl overflow-hidden'>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className='w-full flex items-center gap-3 px-5 py-3 text-start hover:bg-muted/40 transition-colors'
      >
        <span className='min-w-0 flex-1 flex items-center gap-2 flex-wrap'>
          <span className='text-sm font-medium text-foreground truncate'>{order.name}</span>
          <span className='text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground shrink-0'>{typeLabel}</span>
        </span>
        <span className='text-[11px] px-2.5 py-0.5 rounded-full bg-foreground text-background flex items-center gap-1 shrink-0'>
          <Check size={10} />
          {statusLabel}
        </span>
        <ChevronDown
          size={15}
          className={`text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className='border-t border-border'>
          {(order.supplierStatus === 'shipped' || order.supplierStatus === 'delivered') && order.trackingNumber && (
            <p className='px-5 py-2.5 text-xs text-muted-foreground border-b border-border'>
              {t('orders.tracking')}:{' '}
              <span className='text-foreground font-medium' dir='ltr'>
                {order.trackingCarrier ? `${order.trackingCarrier} — ` : ''}{order.trackingNumber}
              </span>
            </p>
          )}
          <div className='p-4'>
            <p className='text-xs text-muted-foreground mb-3'>
              {photos.length} {t('products.selected_of')} {order.maxPhotos}
            </p>
            {photos.length > 0 && (
              <div className='grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2' dir={dir}>
                {photos.map((photo) => (
                  <div key={photo.imageId} className='relative aspect-square rounded-lg overflow-hidden ring-1 ring-border'>
                    <img
                      src={getImageUrl(photo.thumbnailPath || photo.path)}
                      alt={photo.filename}
                      className='w-full h-full object-cover'
                      loading='lazy'
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
        if (data.length > 0) {
          const firstGalleries = data[0].allowedGalleryIds as { _id: string; name: string }[];
          if (firstGalleries.length > 0) {
            try {
              const gRes = await api.get(`/galleries/token/${token}`);
              setClientName(gRes.data.clientName || '');
            } catch { /* optional */ }
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

  if (loading) {
    return (
      <main data-theme="bw" className='min-h-screen bg-background flex items-center justify-center'>
        <div className='w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin' />
      </main>
    );
  }

  if (error) {
    return (
      <main data-theme="bw" className='min-h-screen bg-background flex items-center justify-center px-6'>
        <FadeIn>
          <div className='text-center'>
            <Package size={40} className='mx-auto mb-4 text-muted-foreground' />
            <p className='text-2xl font-semibold text-foreground mb-2'>Link not found</p>
            <p className='text-sm text-muted-foreground'>This link may have expired or is invalid. Please contact your photographer.</p>
          </div>
        </FadeIn>
      </main>
    );
  }

  if (orders.length === 0) {
    return (
      <main data-theme="bw" className='min-h-screen bg-background flex items-center justify-center px-6'>
        <FadeIn>
          <div className='text-center'>
            <ShoppingBag size={40} className='mx-auto mb-4 text-muted-foreground' />
            <p className='text-2xl font-semibold text-foreground mb-2'>{t('products.no_products_title')}</p>
            <p className='text-sm text-muted-foreground'>{t('products.no_products_desc')}</p>
          </div>
        </FadeIn>
      </main>
    );
  }

  const allSubmitted = orders.every((o) => o.status === 'submitted');
  const pendingOrders = orders.filter((o) => o.status !== 'submitted');
  const previousOrders = orders.filter((o) => o.status === 'submitted');

  return (
    <main data-theme="bw" className='min-h-screen bg-background'>
      <header className='bg-background border-b border-border sticky top-0 z-20'>
        <div className='max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3'>
          <ShoppingBag size={18} className='text-foreground shrink-0' />
          <div className='min-w-0'>
            <h1 className='text-lg font-semibold text-foreground leading-tight'>{t('products.section_title')}</h1>
            {clientName && <p className='text-xs text-muted-foreground truncate'>{clientName}</p>}
          </div>
          {allSubmitted && (
            <span className='ms-auto text-xs flex items-center gap-1.5 text-foreground bg-muted border border-border px-3 py-1 rounded-full'>
              <Check size={11} />
              {t('products.submitted')}
            </span>
          )}
        </div>
      </header>

      <div className='max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8'>
        {/* Active orders — full selection panels */}
        {pendingOrders.map((order, i) => (
          <FadeIn key={order._id} delay={i * 0.08}>
            <OrderPanel order={order} onSubmitted={handleSubmitted} stickyTop='top-16' />
          </FadeIn>
        ))}

        {pendingOrders.length === 0 && previousOrders.length > 0 && (
          <FadeIn>
            <div className='text-center py-10'>
              <Check size={32} className='mx-auto mb-3 text-muted-foreground' />
              <p className='text-lg font-semibold text-foreground'>{t('products.all_submitted_title')}</p>
            </div>
          </FadeIn>
        )}

        {/* Previously submitted orders — compact, expandable on demand */}
        {previousOrders.length > 0 && (
          <FadeIn>
            <section>
              <h2 className='text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3'>
                {t('products.previous_orders')} ({previousOrders.length})
              </h2>
              <div className='space-y-2'>
                {previousOrders.map((order) => (
                  <PreviousOrderRow key={order._id} order={order} />
                ))}
              </div>
            </section>
          </FadeIn>
        )}
      </div>

      <footer className='text-center py-8 mt-4'>
        <p className='text-xs text-muted-foreground tracking-widest uppercase'>Light Studio</p>
      </footer>
    </main>
  );
};
