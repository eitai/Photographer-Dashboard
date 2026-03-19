import api from '@/lib/api';

export interface SelectedPhoto {
  galleryId: string;
  imageId: string;
  path: string;
  thumbnailPath?: string;
  filename: string;
}

export interface ProductOrder {
  _id: string;
  adminId: string;
  clientId: string;
  name: string;
  type: 'album' | 'print';
  maxPhotos: number;
  allowedGalleryIds: { _id: string; name: string; isDelivery: boolean }[];
  selectedPhotoIds: SelectedPhoto[];
  status: 'pending' | 'submitted';
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductOrderPayload {
  clientId: string;
  name: string;
  type: 'album' | 'print';
  maxPhotos?: number;
  allowedGalleryIds: string[];
}

// ── Admin ────────────────────────────────────────────────────────────────────

export const fetchProductOrders = (clientId: string): Promise<ProductOrder[]> =>
  api.get(`/product-orders?clientId=${clientId}`).then((r) => r.data);

export const createProductOrder = (payload: CreateProductOrderPayload): Promise<ProductOrder> =>
  api.post('/product-orders', payload).then((r) => r.data);

export const deleteProductOrder = (orderId: string): Promise<void> =>
  api.delete(`/product-orders/${orderId}`).then(() => undefined);

// ── Client (public) ──────────────────────────────────────────────────────────

export const fetchProductOrdersByToken = (token: string): Promise<ProductOrder[]> =>
  api.get(`/product-orders/gallery/${token}`).then((r) => r.data);

export const submitProductOrderSelection = (
  orderId: string,
  selectedPhotoIds: SelectedPhoto[],
): Promise<ProductOrder> =>
  api.put(`/product-orders/${orderId}/selection`, { selectedPhotoIds }).then((r) => r.data);
