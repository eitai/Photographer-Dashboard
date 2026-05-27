import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import api, {
  getMyStorage,
  getAdminStorage,
  setAdminQuota,
  getPublicPlans,
  getMyPlan,
  getAdminPlans,
  updateAdminPlan,
  getAdminSubscriptions,
  getCustomPrice,
  checkoutPlan,
  cancelSubscription,
  reactivateSubscription,
  getInvoices,
  pingS3,
  getSupplierProducts,
  createSupplierProduct,
  updateSupplierProduct,
  deleteSupplierProduct,
  uploadSupplierProductImage,
  getAdminSuppliers,
  createAdminSupplier,
  updateAdminSupplier,
  deleteAdminSupplier,
  toggleSupplierActive,
  setSupplierExclusive,
  getOrders,
  getOrder,
  createOrder,
  sendOrderToClient,
  approveOrder,
  sendOrderToSupplier,
  cancelOrder,
  deleteOrder,
  getSupplierOrders,
  getSupplierOrder,
  updateSupplierOrderStatus,
  getStoreProducts,
  getStoreOrderStatus,
} from '@/lib/api';
import type { Plan, InvoicesResponse, SupplierProduct, Supplier, StoreProductsResponse } from '@/lib/api';
import * as clientService from '@/services/clientService';
import * as galleryService from '@/services/galleryService';
import { fetchProductOrders, updateProductOrderGalleries, deliverProductOrder } from '@/services/productOrderService';
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
  publicPlans: ['plans', 'public'] as const,
  myPlan: ['plans', 'me'] as const,
  adminPlans: ['plans', 'admin'] as const,
  adminSubscriptions: ['plans', 'admin', 'subscriptions'] as const,
  customPrice: (gb: number, interval: string) => ['plans', 'custom-price', gb, interval] as const,
  supplierProducts: ['supplier', 'products'] as const,
  adminSuppliers: ['admin', 'suppliers'] as const,
  orders: ['orders'] as const,
  orderDetail: (id: string) => ['orders', id] as const,
  supplierOrders: ['supplier', 'orders'] as const,
  supplierOrderDetail: (id: string) => ['supplier', 'orders', id] as const,
  storeProducts: (token: string) => ['store', 'products', token] as const,
  storeOrderStatus: (id: string) => ['store', 'order', id] as const,
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
  const pinged = useRef(false);
  useEffect(() => {
    if (pinged.current) return;
    pinged.current = true;
    pingS3()
      .then((result) => console.info('[S3 PING]', result))
      .catch((err) => console.error('[S3 PING] failed:', err?.response?.data || err?.message));
  }, []);

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
// Plan hooks
// ---------------------------------------------------------------------------

export function usePublicPlans() {
  return useQuery({
    queryKey: queryKeys.publicPlans,
    queryFn: getPublicPlans,
    staleTime: 5 * 60_000,
  });
}

export function useMyPlan() {
  return useQuery({
    queryKey: queryKeys.myPlan,
    queryFn: getMyPlan,
    staleTime: 60_000,
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: queryKeys.adminPlans,
    queryFn: getAdminPlans,
    staleTime: 60_000,
  });
}

export function useAdminSubscriptions() {
  return useQuery({
    queryKey: queryKeys.adminSubscriptions,
    queryFn: getAdminSubscriptions,
    staleTime: 60_000,
  });
}

export function useCustomPrice(gb: number, interval: 'monthly' | 'annual', enabled = true) {
  return useQuery({
    queryKey: queryKeys.customPrice(gb, interval),
    queryFn: () => getCustomPrice(gb, interval),
    enabled: enabled && gb > 0,
    staleTime: 30_000,
  });
}

export function useUpdateAdminPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Plan> }) => updateAdminPlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminPlans });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicPlans });
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlan });
    },
  });
}

export function useInvoices(page = 1) {
  return useQuery({
    queryKey: ['plans', 'invoices', page],
    queryFn: () => getInvoices(page),
    staleTime: 60_000,
  });
}

export function useCheckoutPlan() {
  return useMutation({
    mutationFn: ({ planId, billingInterval, customStorageGb }: { planId: string; billingInterval: 'monthly' | 'annual'; customStorageGb?: number }) =>
      checkoutPlan(planId, billingInterval, customStorageGb),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlan });
    },
  });
}

export function useReactivateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reactivateSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPlan });
    },
  });
}

// ---------------------------------------------------------------------------
// Supplier hooks
// ---------------------------------------------------------------------------

export function useSupplierProducts() {
  return useQuery({ queryKey: queryKeys.supplierProducts, queryFn: getSupplierProducts, staleTime: 30_000 });
}

export function useAdminSuppliers() {
  return useQuery({ queryKey: queryKeys.adminSuppliers, queryFn: getAdminSuppliers, staleTime: 30_000 });
}

export function useCreateSupplierProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSupplierProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.supplierProducts }),
  });
}

export function useUpdateSupplierProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SupplierProduct> }) => updateSupplierProduct(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.supplierProducts }),
  });
}

export function useDeleteSupplierProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSupplierProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.supplierProducts }),
  });
}

export function useUploadSupplierProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadSupplierProductImage(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.supplierProducts }),
  });
}

export function useCreateAdminSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminSuppliers }),
  });
}

export function useUpdateAdminSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Supplier, 'id' | 'orderCount'>> }) =>
      updateAdminSupplier(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminSuppliers }),
  });
}

export function useDeleteAdminSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminSuppliers }),
  });
}

export function useToggleSupplierActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleSupplierActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminSuppliers }),
  });
}

export function useSetSupplierExclusive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setSupplierExclusive,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminSuppliers }),
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

export function useSendGallerySms(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (galleryId: string) => galleryService.sendGallerySms(galleryId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(clientId) }),
  });
}

export function useReactivateGallery(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (galleryId: string) => galleryService.reactivateGallery(galleryId),
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
    onSuccess: (_data, { galleryId }) => {
      queryClient.setQueryData(queryKeys.submissions(galleryId), []);
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions(galleryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(clientId) });
    },
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
    onSuccess: (updatedGallery, { id }) => {
      // Write server response directly — no refetch race condition
      queryClient.setQueryData(queryKeys.gallery(id), updatedGallery);
      // Invalidate the flat list and client-scoped lists, but NOT the single gallery
      queryClient.invalidateQueries({ queryKey: queryKeys.galleries, exact: true });
      queryClient.invalidateQueries({ queryKey: ['galleries', 'client'] });
    },
  });
}

export function useDeliverProductOrder(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => deliverProductOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productOrders(clientId) });
    },
  });
}

export function useUpdateProductOrderGalleries(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, allowedGalleryIds }: { orderId: string; allowedGalleryIds: string[] }) =>
      updateProductOrderGalleries(orderId, { allowedGalleryIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productOrders(clientId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Store Order hooks
// ---------------------------------------------------------------------------

export function useOrders(params?: Parameters<typeof getOrders>[0]) {
  return useQuery({ queryKey: [...queryKeys.orders, params], queryFn: () => getOrders(params) });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: queryKeys.orderDetail(id), queryFn: () => getOrder(id), enabled: !!id });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: createOrder, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orders }) });
}

export function useSendOrderToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendOrderToClient,
    onSuccess: (_, id) => qc.invalidateQueries({ queryKey: queryKeys.orderDetail(id) }),
  });
}

export function useApproveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveOrder,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.orderDetail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}

export function useSendOrderToSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendOrderToSupplier,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.orderDetail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.orders });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}

export function useSupplierOrders(params?: Parameters<typeof getSupplierOrders>[0]) {
  return useQuery({ queryKey: [...queryKeys.supplierOrders, params], queryFn: () => getSupplierOrders(params) });
}

export function useSupplierOrder(id: string) {
  return useQuery({ queryKey: queryKeys.supplierOrderDetail(id), queryFn: () => getSupplierOrder(id), enabled: !!id });
}

export function useUpdateSupplierOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSupplierOrderStatus>[1] }) =>
      updateSupplierOrderStatus(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.supplierOrderDetail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.supplierOrders });
    },
  });
}

// ---------------------------------------------------------------------------
// Store public hooks (client self-service Flow B)
// ---------------------------------------------------------------------------

export function useStoreProducts(galleryToken: string) {
  return useQuery<StoreProductsResponse>({
    queryKey: queryKeys.storeProducts(galleryToken),
    queryFn: () => getStoreProducts(galleryToken),
    enabled: !!galleryToken,
    retry: false,
  });
}

export function useStoreOrderStatus(orderId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.storeOrderStatus(orderId),
    queryFn: () => getStoreOrderStatus(orderId),
    enabled: !!orderId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.paymentStatus;
      if (status === 'paid' || status === 'refunded') return false;
      return 3000;
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
