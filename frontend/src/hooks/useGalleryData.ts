import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { GalleryDetail, GalleryImage } from '@/types/admin';
import { queryKeys } from './useQueries';

export const useGalleryData = (id: string | undefined) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const galleryQuery = useQuery<GalleryDetail>({
    queryKey: queryKeys.gallery(id!),
    queryFn: () => api.get(`/galleries/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const imagesQuery = useQuery<GalleryImage[]>({
    queryKey: ['galleries', id, 'images'],
    queryFn: () => api.get(`/galleries/${id}/images`).then((r) => r.data),
    enabled: !!id,
  });

  // Surface fetch errors via toast (v5 no longer accepts onError in useQuery)
  React.useEffect(() => {
    if (galleryQuery.isError) toast.error(t('admin.upload.load_failed'));
  }, [galleryQuery.isError]);

  React.useEffect(() => {
    if (imagesQuery.isError) toast.error(t('admin.upload.images_load_failed'));
  }, [imagesQuery.isError]);

  // Optimistic status update
  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) => api.put(`/galleries/${id}`, { status: newStatus }),
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.gallery(id!) });
      const prev = queryClient.getQueryData<GalleryDetail>(queryKeys.gallery(id!));
      queryClient.setQueryData<GalleryDetail>(queryKeys.gallery(id!), (old) =>
        old ? { ...old, status: newStatus } : old,
      );
      return { prev };
    },
    onError: (_err, _newStatus, context) => {
      if (context?.prev) queryClient.setQueryData(queryKeys.gallery(id!), context.prev);
      toast.error(t('admin.upload.status_update_failed'));
    },
  });

  // Provide a setGallery shim compatible with React.Dispatch<SetStateAction<GalleryDetail | null>>
  // so existing callers (useVideoUpload) don't need changes.
  const setGallery: React.Dispatch<React.SetStateAction<GalleryDetail | null>> = (updater) => {
    queryClient.setQueryData<GalleryDetail>(queryKeys.gallery(id!), (old) => {
      const next = typeof updater === 'function' ? updater(old ?? null) : updater;
      return next ?? undefined;
    });
  };

  return {
    gallery: galleryQuery.data ?? null,
    setGallery,
    loadError: galleryQuery.isError,
    images: imagesQuery.data ?? [],
    // Returns a Promise — compatible with all callers that treat this as () => void
    loadImages: imagesQuery.refetch,
    updateStatus: (newStatus: string) => updateStatusMutation.mutate(newStatus),
  };
};
