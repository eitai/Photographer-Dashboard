import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api, { getImageUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { DeliveryGallery } from '@/components/gallery/DeliveryGallery';
import { SelectionGallery } from '@/components/gallery/SelectionGallery';
import { FaceFilterStrip } from '@/components/gallery/FaceFilterStrip';
import { StoreTab } from '@/components/gallery/StoreTab';
import { useStoreProducts } from '@/hooks/useQueries';
import type { GalleryData, GalleryImage } from '@/types/gallery';

export const ClientGallery = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useI18n();
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeFaceGroupKey, setActiveFaceGroupKey] = useState<string | null>(null);
  const [faceFilteredIds, setFaceFilteredIds] = useState<Set<string> | null>(null);
  const [activeTab, setActiveTab] = useState<'gallery' | 'store'>('gallery');
  const resolveImageUrl = useCallback((path: string) => getImageUrl(path), []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const gRes = await api.get(`/galleries/token/${token}`);
        const galleryData: GalleryData = gRes.data;
        setGallery(galleryData);
        const imgRes = await api.get(`/galleries/${galleryData._id}/images`);
        setImages(imgRes.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Fetch store products to determine whether to show the Store tab.
  // retry:false so a missing/unconfigured supplier doesn't spam the console.
  // This hook must be called unconditionally (rules of hooks).
  const { data: storeData } = useStoreProducts(token ?? '');
  const hasStore = !!(storeData?.products?.length && storeData.products.length > 0);

  const header = (
    <header className='h-20 shrink-0 flex items-center justify-between px-6 bg-background border-b border-border'>
      <img src='/logos/logo.png' style={{ mixBlendMode: 'multiply' }} alt='LIGHT STUDIO' className='h-14 w-auto' />
      {gallery && (
        <p className='font-body text-sm text-muted-foreground truncate ms-4'>{gallery.name}</p>
      )}
    </header>
  );

  const themeWrapper = (children: React.ReactNode) => (
    <div data-theme='bw' style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }} className='flex flex-col'>
      {children}
    </div>
  );

  if (loading) {
    return themeWrapper(
      <>
        {header}
        <div className='flex-1 flex items-center justify-center'>
          <div className='w-8 h-8 border-2 border-t-transparent rounded-full animate-spin' style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
      </>
    );
  }

  if (error || !gallery) {
    return themeWrapper(
      <>
        {header}
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center px-6'>
            <p className='text-2xl mb-2' style={{ color: 'var(--foreground)' }}>{t('gallery.not_found')}</p>
            <p className='text-sm font-sans' style={{ color: 'var(--muted-foreground)' }}>{t('gallery.link_expired')}</p>
          </div>
        </div>
      </>
    );
  }

  if (gallery.isDelivery) {
    return themeWrapper(
      <>
        {header}
        <DeliveryGallery gallery={gallery} images={images} getImageUrl={resolveImageUrl} />
      </>
    );
  }

  // Selection gallery — with optional Store tab
  if (hasStore && token) {
    const tabBar = (
      <div className='flex border-b border-border bg-background shrink-0' role='tablist'>
        <button
          type='button'
          role='tab'
          aria-selected={activeTab === 'gallery'}
          onClick={() => setActiveTab('gallery')}
          className={`px-6 py-3 text-sm font-body font-medium -mb-px border-b-2 transition-colors ${
            activeTab === 'gallery'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('gallery.tab')}
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={activeTab === 'store'}
          onClick={() => setActiveTab('store')}
          className={`px-6 py-3 text-sm font-body font-medium -mb-px border-b-2 transition-colors ${
            activeTab === 'store'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('store.tab')}
        </button>
      </div>
    );

    return themeWrapper(
      <>
        {header}
        {tabBar}
        {activeTab === 'gallery' ? (
          <>
            <div className='px-4 pt-4'>
              <FaceFilterStrip
                galleryId={gallery._id}
                showNames={false}
                selectedGroupKey={activeFaceGroupKey}
                onSelect={(groupKey, imageIds) => {
                  setActiveFaceGroupKey(groupKey);
                  setFaceFilteredIds(groupKey ? new Set(imageIds) : null);
                }}
                galleryToken={token}
              />
            </div>
            <SelectionGallery
              gallery={gallery}
              images={images}
              getImageUrl={resolveImageUrl}
              filteredImageIds={faceFilteredIds}
            />
          </>
        ) : (
          <StoreTab
            galleryToken={token}
            galleryImages={images}
            getImageUrl={resolveImageUrl}
          />
        )}
      </>
    );
  }

  // No store — render exactly as before
  return themeWrapper(
    <>
      {header}
      {gallery && token && (
        <div className='px-4 pt-4'>
          <FaceFilterStrip
            galleryId={gallery._id}
            showNames={false}
            selectedGroupKey={activeFaceGroupKey}
            onSelect={(groupKey, imageIds) => {
              setActiveFaceGroupKey(groupKey);
              setFaceFilteredIds(groupKey ? new Set(imageIds) : null);
            }}
            galleryToken={token}
          />
        </div>
      )}
      <SelectionGallery
        gallery={gallery}
        images={images}
        getImageUrl={resolveImageUrl}
        filteredImageIds={faceFilteredIds}
      />
    </>
  );
};
