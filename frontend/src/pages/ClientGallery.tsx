import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { DeliveryGallery } from '@/components/gallery/DeliveryGallery';
import { SelectionGallery } from '@/components/gallery/SelectionGallery';
import { ProductOrdersClient } from '@/components/gallery/ProductOrdersClient';
import { fetchProductOrdersByToken } from '@/services/productOrderService';
import type { GalleryData, GalleryImage } from '@/types/gallery';
import type { ProductOrder } from '@/services/productOrderService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const ClientGallery = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useI18n();
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [productOrders, setProductOrders] = useState<ProductOrder[]>([]);
  const [theme, setTheme] = useState('soft');

  const getImageUrl = useCallback((path: string) => `${API_BASE}${path}`, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const gRes = await api.get(`/galleries/token/${token}`);
        const galleryData: GalleryData = gRes.data;
        setGallery(galleryData);
        const imgRes = await api.get(`/galleries/${galleryData._id}/images`);
        setImages(imgRes.data);
        // Load photographer theme — non-blocking
        if (galleryData.adminId) {
          try {
            const settingsRes = await api.get(`/p/${galleryData.adminId}/settings`);
            setTheme(settingsRes.data.theme || 'soft');
          } catch {
            // theme is optional — fall back to default
          }
        }
        // Load product orders for this client — non-blocking, no error on failure
        try {
          const orders = await fetchProductOrdersByToken(token);
          setProductOrders(orders);
        } catch {
          // product orders are optional — silently ignore
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const header = (
    <header className='h-14 shrink-0 flex items-center px-6 bg-white border-b border-beige'>
      <img src='/logos/03_logo_horizontal_transparent.png' alt='Koral' className='h-8 w-auto' />
    </header>
  );

  const themeWrapper = (children: React.ReactNode) => (
    <div data-theme={theme} style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }} className='flex flex-col'>
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
        <DeliveryGallery gallery={gallery} images={images} getImageUrl={getImageUrl} />
      </>
    );
  }

  return themeWrapper(
    <>
      {header}
      <SelectionGallery gallery={gallery} images={images} getImageUrl={getImageUrl} />
      {productOrders.length > 0 && <ProductOrdersClient orders={productOrders} getImageUrl={getImageUrl} />}
    </>
  );
};
