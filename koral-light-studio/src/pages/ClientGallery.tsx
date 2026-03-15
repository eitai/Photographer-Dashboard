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

  const getImageUrl = useCallback((path: string) => `${API_BASE}${path}`, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const gRes = await api.get(`/galleries/token/${token}`);
        setGallery(gRes.data);
        const imgRes = await api.get(`/galleries/${gRes.data._id}/images`);
        setImages(imgRes.data);
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

  if (loading) {
    return (
      <main className='pt-16 min-h-screen flex items-center justify-center'>
        <div className='w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin' />
      </main>
    );
  }

  if (error || !gallery) {
    return (
      <main className='pt-16 min-h-screen flex items-center justify-center'>
        <div className='text-center px-6'>
          <p className=' text-2xl text-foreground mb-2'>{t('gallery.not_found')}</p>
          <p className='text-muted-foreground text-sm'>{t('gallery.link_expired')}</p>
        </div>
      </main>
    );
  }

  if (gallery.isDelivery) {
    return <DeliveryGallery gallery={gallery} images={images} getImageUrl={getImageUrl} />;
  }

  return (
    <>
      <SelectionGallery gallery={gallery} images={images} getImageUrl={getImageUrl} />
      {productOrders.length > 0 && <ProductOrdersClient orders={productOrders} getImageUrl={getImageUrl} />}
    </>
  );
};
