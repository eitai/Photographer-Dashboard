import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import * as clientService from '@/services/clientService';
import * as galleryService from '@/services/galleryService';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  clients: ['clients'] as const,
  client: (id: string) => ['clients', id] as const,
  galleries: ['galleries'] as const,
  galleriesByClient: (clientId: string) => ['galleries', 'client', clientId] as const,
  submissions: (galleryId: string) => ['submissions', galleryId] as const,
  blog: ['blog'] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useClients() {
  return useQuery({ queryKey: queryKeys.clients, queryFn: clientService.listClients });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.client(id),
    queryFn: () => clientService.getClient(id),
    enabled: !!id,
  });
}

export function useGalleries() {
  return useQuery({ queryKey: queryKeys.galleries, queryFn: galleryService.listGalleries });
}

export function useGalleriesByClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.galleriesByClient(clientId),
    queryFn: () => galleryService.fetchGalleries(clientId),
    enabled: !!clientId,
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
    queryKey: queryKeys.blog,
    queryFn: () => api.get('/blog?admin=1').then((r) => r.data.length as number),
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
    mutationFn: (data: any) => clientService.updateClient(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.client(id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useCreateDelivery(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ galleryId, data }: { galleryId: string; data: any }) =>
      galleryService.createDelivery(galleryId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(clientId) }),
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

export function useUpdateGallery(invalidateKey?: readonly string[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      galleryService.updateGallery(id, data),
    onSuccess: () => {
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: invalidateKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.galleries });
    },
  });
}
