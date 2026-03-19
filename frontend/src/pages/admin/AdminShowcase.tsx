import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import api from '@/lib/api';
import { X, Check, Search, Maximize2 } from 'lucide-react';
import { Lightbox, type LightboxImage } from '@/components/gallery/Lightbox';
import type { ShowcaseGallery } from '@/types/gallery';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PAGE_SIZE = 50;

export const AdminShowcase = () => {
  const [galleries, setGalleries] = useState<ShowcaseGallery[]>([]);
  const [featuredImages, setFeaturedImages] = useState<LightboxImage[]>([]);
  const [browseGalleryId, setBrowseGalleryId] = useState('');
  const [browseImages, setBrowseImages] = useState<LightboxImage[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browsePage, setBrowsePage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxSource, setLightboxSource] = useState<'browse' | 'featured'>('browse');

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get('/settings')
      .then((r) => setFeaturedImages(r.data.featuredImages || []))
      .catch(() => {});
    api
      .get('/galleries')
      .then((r) => setGalleries(r.data))
      .catch(() => {});
  }, []);

  // Reset + load page 1 whenever gallery changes
  useEffect(() => {
    if (!browseGalleryId) {
      setBrowseImages([]);
      setBrowseTotal(0);
      setBrowsePage(1);
      return;
    }
    setBrowseImages([]);
    setBrowseTotal(0);
    setBrowsePage(1);
    api
      .get(`/galleries/${browseGalleryId}/images?page=1&limit=${PAGE_SIZE}`)
      .then((r) => {
        setBrowseImages(r.data.images);
        setBrowseTotal(r.data.total);
      })
      .catch(() => {});
  }, [browseGalleryId]);

  // Load next page
  const loadMore = useCallback(async () => {
    if (loadingMore || browseImages.length >= browseTotal) return;
    setLoadingMore(true);
    const nextPage = browsePage + 1;
    try {
      const r = await api.get(`/galleries/${browseGalleryId}/images?page=${nextPage}&limit=${PAGE_SIZE}`);
      setBrowseImages((prev) => [...prev, ...r.data.images]);
      setBrowsePage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, browseImages.length, browseTotal, browsePage, browseGalleryId]);

  // IntersectionObserver sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const filteredGalleries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return galleries;
    return galleries.filter((g) => {
      const name = (g.clientId?.name || g.clientName || '').toLowerCase();
      const email = (g.clientId?.email || '').toLowerCase();
      const galleryName = (g.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || galleryName.includes(q);
    });
  }, [galleries, search]);

  const toggleFeatured = (img: any) => {
    setFeaturedImages((prev) =>
      prev.some((f) => f._id === img._id) ? prev.filter((f) => f._id !== img._id) : prev.length < 20 ? [...prev, img] : prev,
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put('/settings/featured', { imageIds: featuredImages.map((f) => f._id) });
      setFeaturedImages(r.data.featuredImages);
      setMsg('נשמר בהצלחה ✓');
      setTimeout(() => setMsg(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  const selectedGallery = galleries.find((g) => g._id === browseGalleryId);
  const hasMore = browseImages.length < browseTotal;

  return (
    <AdminLayout title='תמונות ראווה'>
      <div className='max-w-5xl space-y-6'>
        {/* Search + gallery picker */}
        <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>חיפוש לפי שם לקוח, אימייל או שם גלריה</label>
            <div className='relative'>
              <Search size={15} className='absolute right-3 top-1/2 -translate-y-1/2 text-warm-gray pointer-events-none' />
              <input
                type='text'
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setBrowseGalleryId('');
                }}
                placeholder='חפש...'
                className='w-full pr-9 pl-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
            </div>
          </div>

          {filteredGalleries.length === 0 ? (
            <p className='text-sm text-warm-gray'>לא נמצאו גלריות</p>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1'>
              {filteredGalleries.map((g) => (
                <button
                  key={g._id}
                  onClick={() => setBrowseGalleryId(g._id === browseGalleryId ? '' : g._id)}
                  className={`text-right px-4 py-3 rounded-lg border text-sm transition-colors ${
                    browseGalleryId === g._id
                      ? 'border-blush bg-blush/10 text-charcoal font-medium'
                      : 'border-beige hover:bg-ivory text-charcoal'
                  }`}
                >
                  <p className='font-medium truncate'>{g.name}</p>
                  <p className='text-xs text-warm-gray truncate mt-0.5'>
                    {g.clientId?.name || g.clientName}
                    {g.clientId?.email ? ` · ${g.clientId.email}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Image browser */}
        {browseGalleryId && (
          <div className='bg-card rounded-xl border border-beige p-6 space-y-3'>
            <div className='flex items-center justify-between'>
              <p className='text-sm font-medium text-charcoal'>{selectedGallery?.name} — בחר תמונות</p>
              {browseTotal > 0 && (
                <span className='text-xs text-warm-gray'>
                  {browseImages.length} / {browseTotal}
                </span>
              )}
            </div>

            {browseImages.length === 0 && !loadingMore ? (
              <p className='text-sm text-warm-gray'>אין תמונות בגלריה זו</p>
            ) : (
              <>
                <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2'>
                  {browseImages.map((img: any, i: number) => {
                    const selected = featuredImages.some((f) => f._id === img._id);
                    return (
                      <div
                        key={img._id}
                        className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          selected ? 'border-blush ring-2 ring-blush/40' : 'border-transparent hover:border-beige'
                        }`}
                        onClick={() => toggleFeatured(img)}
                      >
                        <img
                          src={`${API_BASE}${img.thumbnailPath || img.path}`}
                          alt=''
                          className='w-full h-full object-cover'
                          loading='lazy'
                          decoding='async'
                        />
                        {selected && (
                          <div className='absolute inset-0 bg-blush/25 flex items-center justify-center pointer-events-none'>
                            <Check size={18} className='text-white drop-shadow' />
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxSource('browse');
                            setLightboxIndex(i);
                          }}
                          className='absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'
                        >
                          <Maximize2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Infinite scroll sentinel */}
                {hasMore && (
                  <div ref={sentinelRef} className='flex justify-center py-4'>
                    {loadingMore && <div className='w-5 h-5 rounded-full border-2 border-beige border-t-blush animate-spin' />}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Selected featured images + save */}
        <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className=' text-charcoal'>תמונות שנבחרו לדף הבית</h2>
            <span className='text-xs text-warm-gray'>{featuredImages.length}/20</span>
          </div>

          {featuredImages.length === 0 ? (
            <p className='text-sm text-warm-gray'>טרם נבחרו תמונות</p>
          ) : (
            <div className='grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2'>
              {featuredImages.map((img: any, i: number) => (
                <div
                  key={img._id}
                  className='relative aspect-square rounded-lg overflow-hidden group cursor-pointer'
                  onClick={() => {
                    setLightboxSource('featured');
                    setLightboxIndex(i);
                  }}
                >
                  <img
                    src={`${API_BASE}${img.thumbnailPath || img.path}`}
                    alt=''
                    className='w-full h-full object-cover'
                    loading='lazy'
                    decoding='async'
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFeatured(img);
                    }}
                    className='absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity'
                  >
                    <X size={12} className='text-white' />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className='flex items-center gap-3 pt-1'>
            <button
              onClick={save}
              disabled={saving}
              className='bg-blush text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {saving ? 'שומר...' : 'שמור'}
            </button>
            {msg && <span className='text-sm text-charcoal'>{msg}</span>}
          </div>
        </div>
      </div>

      {lightboxIndex !== null &&
        (() => {
          const sourceImages = lightboxSource === 'featured' ? featuredImages : browseImages;
          const img = sourceImages[lightboxIndex];
          return (
            <Lightbox
              images={sourceImages}
              index={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onPrev={() => setLightboxIndex((i) => (i! > 0 ? i! - 1 : i!))}
              onNext={() => setLightboxIndex((i) => (i! < sourceImages.length - 1 ? i! + 1 : i!))}
              getImageUrl={(path) => `${API_BASE}${path}`}
              showDownload={false}
              isFeatured={featuredImages.some((f) => f._id === img._id)}
              onToggleFeatured={() => toggleFeatured(img)}
            />
          );
        })()}
    </AdminLayout>
  );
};
