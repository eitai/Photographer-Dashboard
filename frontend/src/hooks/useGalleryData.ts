import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { toast } from 'sonner';
import { GalleryDetail, GalleryImage } from '@/types/admin';

export const useGalleryData = (id: string | undefined) => {
  const { t } = useI18n();
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);

  const loadImages = async () => {
    try {
      const r = await api.get(`/galleries/${id}/images`);
      setImages(r.data);
    } catch {
      setImages([]);
      toast.error(t('admin.upload.images_load_failed'));
    }
  };

  const loadGallery = async () => {
    try {
      const r = await api.get(`/galleries/${id}`);
      setGallery(r.data);
    } catch {
      setLoadError(true);
      toast.error(t('admin.upload.load_failed'));
    }
  };

  const updateStatus = async (newStatus: string) => {
    const prevStatus = gallery?.status;
    setGallery((g) => (g ? { ...g, status: newStatus } : g));
    try {
      await api.put(`/galleries/${id}`, { status: newStatus });
    } catch {
      setGallery((g) => (g ? { ...g, status: prevStatus! } : g));
      toast.error(t('admin.upload.status_update_failed'));
    }
  };

  useEffect(() => {
    loadGallery();
    loadImages();
  }, [id]);

  return { gallery, setGallery, loadError, images, loadImages, updateStatus };
};
