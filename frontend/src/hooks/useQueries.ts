import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getMyStorage, getAdminStorage, setAdminQuota } from '@/lib/api';
import * as clientService from '@/services/clientService';
import * as galleryService from '@/services/galleryService';
import { fetchProductOrders } from '@/services/productOrderService';
import { Client } from '@/types/admin';
import type { GalleryData } from '@/types/gallery';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  clients: ['clients'] as const,
  client: (id: string) => ['clients', id] as const,
  galleries: ['galleries'] as const,
  gallery: (id: string) => ['galleries', id] as const,
  galleriesByClient: (clientId: string) => ['galleries', 'client', clientId] as const,
  submissions: (galleryId: string) => ['submissions', galleryId] as const,
  blog: ['blog'] as const,
  blogCount: ['blog', 'count'] as const,
  blogPosts: (adminId?: string) => adminId ? ['blog', 'posts', adminId] : ['blog', 'posts'],
  settings: ['settings'] as const,
  admins: ['admins'] as const,
  productOrders: (clientId: string) => ['product-orders', clientId] as const,
  adminProducts: ['admin-products'] as const,
  storageMe: ['storage', 'me'] as const,
  adminStorage: (id: string) => ['storage', 'admin', id] as const,
  galleryPreview: (galleryId: string) => ['galleries', galleryId, 'preview'] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: clientService.listClients,
    staleTime: 30_000,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.client(id),
    queryFn: () => clientService.getClient(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useGalleries() {
  return useQuery({
    queryKey: queryKeys.galleries,
    queryFn: galleryService.listGalleries,
    staleTime: 30_000,
  });
}

export function useGalleriesByClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.galleriesByClient(clientId),
    queryFn: () => galleryService.fetchGalleries(clientId),
    enabled: !!clientId,
  });
}

export function useGalleryPreviewImages(galleryId: string) {
  return useQuery({
    queryKey: queryKeys.galleryPreview(galleryId),
    queryFn: async () => {
      const res = await api.get(`/galleries/${galleryId}/images?limit=5&page=1`);
      return (res.data.images ?? res.data) as import('@/types/gallery').GalleryImage[];
    },
    enabled: !!galleryId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmissions(galleryId: string) {
  return useQuery({
    queryKey: queryKeys.submissions(galleryId),
    queryFn: () => galleryService.fetchSubmissions(galleryId),
    enabled: !!galleryId,
  });
}

export function useBlogCount() {
  return useQuery({
    queryKey: queryKeys.blogCount,
    queryFn: () => api.get<{ count: number }>('/blog/count').then((r) => r.data.count),
    staleTime: 60_000,
  });
}

export function useBlogPosts(adminId?: string) {
  return useQuery({
    queryKey: queryKeys.blogPosts(adminId) as readonly string[],
    queryFn: async () => {
      const url = adminId ? `/blog?adminId=${adminId}` : '/blog?admin=1';
      const r = await api.get(url);
      return r.data;
    },
    staleTime: 60_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => api.get('/settings').then((r) => r.data as Record<string, any>),
    staleTime: 120_000,
  });
}

export function useAdmins() {
  return useQuery({
    queryKey: queryKeys.admins,
    queryFn: () => api.get('/admins').then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useProductOrders(clientId: string) {
  return useQuery({
    queryKey: queryKeys.productOrders(clientId),
    queryFn: () => fetchProductOrders(clientId),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

export interface AdminProduct {
  id: string;
  adminId: string;
  name: string;
  type: 'album' | 'print';
  maxPhotos: number;
  createdAt: string;
}

export function useAdminProducts() {
  return useQuery({
    queryKey: queryKeys.adminProducts,
    queryFn: () => api.get<AdminProduct[]>('/admin-products').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useMyStorage() {
  return useQuery({
    queryKey: queryKeys.storageMe,
    queryFn: getMyStorage,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useAdminStorage(adminId: string) {
  return useQuery({
    queryKey: queryKeys.adminStorage(adminId),
    queryFn: () => getAdminStorage(adminId),
    enabled: !!adminId,
    staleTime: 30_000,
  });
}

export function useSetAdminQuota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ adminId, quotaGB }: { adminId: string; quotaGB: number }) =>
      setAdminQuota(adminId, quotaGB),
    onSuccess: (_, { adminId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admins });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStorage(adminId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientService.createClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients }),
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientService.deleteClient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients }),
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Client>) => clientService.updateClient(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.client(id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useCreateDelivery(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ galleryId, data }: { galleryId: string; data: Record<string, unknown> }) =>
      galleryService.createDelivery(galleryId, data as { headerMessage: string; name?: string }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.galleries }),
  });
}

export function useResendGalleryEmail(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (galleryId: string) => galleryService.resendGalleryEmail(galleryId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(clientId) }),
  });
}

export function useDeleteGallery(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (galleryId: string) => galleryService.removeGallery(galleryId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(clientId) }),
  });
}

export function useDeleteSubmission(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ galleryId, submissionId }: { galleryId: string; submissionId: string }) =>
      galleryService.removeSubmission(galleryId, submissionId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(clientId) }),
  });
}

export function useDeleteSubmissionImage(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      galleryId,
      submissionId,
      imageId,
    }: {
      galleryId: string;
      submissionId: string;
      imageId: string;
    }) => galleryService.removeSubmissionImage(galleryId, submissionId, imageId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(clientId) }),
  });
}

export function useUpdateGallery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      galleryService.updateGallery(id, data as Partial<GalleryData>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.galleries });
    },
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, string>) => api.post('/admins', data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admins }),
  });
}

export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admins/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admins }),
  });
}
