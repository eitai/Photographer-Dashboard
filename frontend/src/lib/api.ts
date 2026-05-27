import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const S3_PUBLIC_URL = (import.meta.env.VITE_S3_PUBLIC_URL || '').replace(/\/$/, '');

/**
 * Resolve a stored image/video path to a fully-qualified URL.
 *
 * If VITE_S3_PUBLIC_URL is set (public bucket), raw S3 keys and full S3 URLs
 * are served directly from the bucket — faster, no backend proxy hop.
 * Without it, all S3 paths go through /api/media/ (private bucket proxy).
 *
 * Handled formats:
 *  1. Raw S3 key  — "admins/<id>/file.jpg" or "face-references/..."
 *  2. Full S3 URL — any provider (AWS, Wasabi, R2, MinIO, …)
 *  3. Local /uploads/... path (dev, S3 disabled) — prepend backend base URL
 *  4. Unrecognised https:// — returned as-is
 */
export const getImageUrl = (path: string): string => {
  if (!path) return '';
  // Local static file (dev, S3 not configured)
  if (path.startsWith('/')) return `${API_BASE}${path}`;
  // Full S3 URL — extract the raw key then re-resolve
  if (path.startsWith('https://')) {
    for (const prefix of ['/admins/', '/face-references/']) {
      const idx = path.indexOf(prefix);
      if (idx !== -1) {
        const key = path.slice(idx + 1);
        return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : `${API_BASE}/api/media?k=${encodeURIComponent(key)}`;
      }
    }
    return path;
  }
  // Raw S3 key (e.g. "admins/<id>/file.jpg" or "face-references/...")
  return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${path}` : `${API_BASE}/api/media?k=${encodeURIComponent(path)}`;
};

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
  // Required for the browser to send/receive httpOnly cookies cross-origin
  withCredentials: true,
});

// Auth is cookie-first (httpOnly session cookie set by the server).
// koral_admin_token and koral_admin_user are UI-only cache and must both
// be cleared so the next render does not flash a stale user name.
// Use replace() so the login page is not on the history stack —
// pressing Back must not return to a protected route.
function clearAuthAndRedirect() {
  localStorage.removeItem('koral_admin_token');
  localStorage.removeItem('koral_admin_user');
  window.location.replace('/admin');
}

// Handle 401 — clear local user state and redirect to login.
// Skip cancelled requests: when queryClient.clear() aborts an in-flight /auth/me
// during logout, we don't want that stale 401 to interrupt a concurrent login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ERR_CANCELED') return Promise.reject(err);
    if (err.response?.status === 401) {
      clearAuthAndRedirect();
    }
    return Promise.reject(err);
  }
);

// ---- Auth ----
// Accepts the AbortSignal from React Query so the request is properly cancelled
// when queryClient.clear() is called (e.g. on logout).
export const verifyAuth = ({ signal }: { signal: AbortSignal }): Promise<{ admin: import('@/store/authStore').AdminUser }> =>
  api.get('/auth/me', { signal }).then((r) => r.data);

// ---- Storage ----
export const getMyStorage = (): Promise<import('@/types/admin').StorageStats> =>
  api.get('/storage/me').then((r) => r.data).catch((err) => {
    const detail = err?.response?.data?.detail || err?.response?.data?.error || err?.message;
    console.error('[S3 ERROR] /api/storage/me failed:', detail, err?.response?.data);
    throw err;
  });

export const pingS3 = (): Promise<Record<string, unknown>> =>
  api.get('/storage/s3-ping').then((r) => r.data);

export const getAdminStorage = (adminId: string): Promise<import('@/types/admin').StorageStats> =>
  api.get(`/admins/${adminId}/storage`).then((r) => r.data);

export const setAdminQuota = (adminId: string, quotaGB: number): Promise<{ adminId: string; quotaBytes: number; quotaGB: number }> =>
  api.patch(`/admins/${adminId}/quota`, { quotaGB }).then((r) => r.data);

// ---- Plans ----
export interface Plan {
  id: string;
  slug: string;
  name: string;
  storageBytes: number | null;
  priceMonthlyIls: number;
  priceAnnualIls: number;
  pricePerGbIls: number | null;
  customMinGb: number | null;
  customMaxGb: number | null;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  status: string;
  billingInterval: 'monthly' | 'annual';
  customStorageGb: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface MyPlanResponse {
  plan: Plan;
  subscription: Subscription;
  storage: {
    usedBytes: number;
    quotaBytes: number | null;
    usedGb: number;
    quotaGb: number | null;
    percentUsed: number;
  };
}

export interface CustomPriceResponse {
  gb: number;
  pricePerGb: number;
  totalMonthly: number;
  totalAnnual: number;
  annualDiscount: number;
  effectiveMonthlyIfAnnual: number;
}

export const getPublicPlans = (): Promise<Plan[]> =>
  api.get('/plans').then((r) => r.data);

export const getMyPlan = (): Promise<MyPlanResponse> =>
  api.get('/plans/me').then((r) => r.data);

export const getCustomPrice = (gb: number, billingInterval: 'monthly' | 'annual'): Promise<CustomPriceResponse> =>
  api.get('/plans/custom-price', { params: { gb, billingInterval } }).then((r) => r.data);

export const getAdminPlans = (): Promise<Plan[]> =>
  api.get('/plans/admin').then((r) => r.data);

export const updateAdminPlan = (id: string, data: Partial<Plan>): Promise<Plan> =>
  api.put(`/plans/admin/${id}`, data).then((r) => r.data);

export interface AdminSubscription {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  plan: Plan;
  subscription: Subscription;
}

export const getAdminSubscriptions = (): Promise<AdminSubscription[]> =>
  api.get('/plans/admin/subscriptions').then((r) => r.data);

export const overrideAdminSubscription = (adminId: string, data: { planId: string; billingInterval?: string }) =>
  api.patch(`/plans/admin/subscriptions/${adminId}`, data).then((r) => r.data);

// PayPlus billing
export interface InvoiceItem {
  id: string;
  type: string;
  amount: number | null;
  currency: string;
  description: string | null;
  created_at: string;
}

export interface InvoicesResponse {
  invoices: InvoiceItem[];
  total: number;
  page: number;
  limit: number;
}

export const checkoutPlan = (planId: string, billingInterval: 'monthly' | 'annual', customStorageGb?: number): Promise<{ url: string }> =>
  api.post('/plans/checkout', { planId, billingInterval, customStorageGb }).then((r) => r.data);

export const cancelSubscription = (): Promise<unknown> =>
  api.post('/plans/cancel').then((r) => r.data);

export const reactivateSubscription = (): Promise<unknown> =>
  api.post('/plans/reactivate').then((r) => r.data);

export const getInvoices = (page = 1): Promise<InvoicesResponse> =>
  api.get('/plans/invoices', { params: { page } }).then((r) => r.data);

// ---- Face Reference ----

export interface FaceReferenceStatus {
  hasReference: boolean;
  imagePath?: string;
  modelVersion?: string;
  updatedAt?: string;
}

export interface FaceReferenceUploadResult {
  referenceId: string;
  clientId: string;
}

export const getClientFaceReference = (clientId: string): Promise<FaceReferenceStatus> =>
  api.get(`/clients/${clientId}/face-reference`).then((r) => r.data);

export const uploadClientFaceReference = (clientId: string, file: File): Promise<FaceReferenceUploadResult> => {
  const formData = new FormData();
  formData.append('reference', file);
  return api
    .post(`/clients/${clientId}/face-reference`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const deleteClientFaceReference = (clientId: string): Promise<void> =>
  api.delete(`/clients/${clientId}/face-reference`).then((r) => r.data);

export interface TaggedImagesPage {
  images: import('@/types/admin').GalleryImage[];
  total: number;
  page: number;
  totalPages: number;
}

export const getClientTaggedImages = (clientId: string, page = 1, limit = 50): Promise<TaggedImagesPage> =>
  api.get(`/clients/${clientId}/tagged-images`, { params: { page, limit } }).then((r) => r.data);

// ---- Face Recognition Jobs ----

export type FaceRecognitionJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface FaceRecognitionJob {
  id: string;
  galleryId: string;
  totalImages: number;
  processed: number;
  matched: number;
  status: FaceRecognitionJobStatus;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
}

export const getFaceRecognitionStatus = (galleryId: string): Promise<FaceRecognitionJob> =>
  api.get(`/galleries/${galleryId}/face-recognition/status`).then((r) => r.data);

export const runFaceRecognition = (galleryId: string): Promise<{ jobId: string }> =>
  api.post(`/galleries/${galleryId}/face-recognition/run`).then((r) => r.data);

// ---- Face Tags ----

export interface FaceTag {
  id: string;
  clientId: string;
  clientName?: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  status: string;
  confirmedByAdmin: boolean;
}

export const getImageFaceTags = (galleryId: string, imageId: string): Promise<FaceTag[]> =>
  api.get(`/galleries/${galleryId}/images/${imageId}/face-tags`).then((r) => r.data);

export const updateFaceTag = (
  galleryId: string,
  imageId: string,
  tagId: string,
  data: { confirmed?: boolean; clientId?: string },
): Promise<FaceTag> =>
  api.patch(`/galleries/${galleryId}/images/${imageId}/face-tags/${tagId}`, data).then((r) => r.data);

export const deleteFaceTag = (galleryId: string, imageId: string, tagId: string): Promise<void> =>
  api.delete(`/galleries/${galleryId}/images/${imageId}/face-tags/${tagId}`).then((r) => r.data);

// ---- Face Groups (filter strip) ----

export interface FaceGroup {
  groupKey: string;
  status: 'matched' | 'unmatched';
  clientId: string | null;
  clientName?: string | null;
  referencePhotoPath?: string | null;
  repBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  repThumbnailPath?: string | null;
  faceCropPath?: string | null;
  photoCount: number;
  imageIds: string[];
}

export const getGalleryFaceGroups = (galleryId: string): Promise<FaceGroup[]> =>
  api.get(`/galleries/${galleryId}/face-recognition/faces`).then((r) => r.data);

export const getGalleryFaceGroupsPublic = (galleryId: string, token: string): Promise<FaceGroup[]> =>
  api.get(`/galleries/${galleryId}/face-recognition/faces`, { params: { token } }).then((r) => r.data);

export default api;

// ---- Supplier Auth & Products ----
export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  contactPerson: string | null;
  logoPath: string | null;
  isActive: boolean;
  isExclusive: boolean;
  orderCount?: number;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  name: string;
  type: 'print' | 'canvas' | 'album' | 'digital' | 'other';
  description: string | null;
  sku: string | null;
  specs: Record<string, unknown>;
  costPrice: number;
  clientPrice: number | null;
  imagePreviewPath: string | null;
  isActive: boolean;
  sortOrder: number;
}

export const supplierLogin = (email: string, password: string): Promise<{ supplier: Supplier }> =>
  api.post('/supplier/auth/login', { email, password }).then((r) => r.data);

export const supplierLogout = (): Promise<void> =>
  api.post('/supplier/auth/logout').then(() => undefined);

export const getSupplierMe = (): Promise<{ supplier: Supplier }> =>
  api.get('/supplier/auth/me').then((r) => r.data);

export const getSupplierProducts = (): Promise<SupplierProduct[]> =>
  api.get('/supplier/products').then((r) => r.data);

export const createSupplierProduct = (data: Partial<SupplierProduct>): Promise<SupplierProduct> =>
  api.post('/supplier/products', data).then((r) => r.data);

export const updateSupplierProduct = (id: string, data: Partial<SupplierProduct>): Promise<SupplierProduct> =>
  api.put(`/supplier/products/${id}`, data).then((r) => r.data);

export const deleteSupplierProduct = (id: string): Promise<void> =>
  api.delete(`/supplier/products/${id}`).then(() => undefined);

export const uploadSupplierProductImage = (id: string, file: File): Promise<SupplierProduct> => {
  const form = new FormData();
  form.append('image', file);
  return api.post(`/supplier/products/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const reorderSupplierProducts = (items: { id: string; sortOrder: number }[]): Promise<void> =>
  api.put('/supplier/products/reorder', items).then(() => undefined);

// ---- Admin Suppliers ----
export const getAdminSuppliers = (): Promise<Supplier[]> =>
  api.get('/admin/suppliers').then((r) => r.data);

export const createAdminSupplier = (data: {
  name: string; email: string; password: string; phone?: string; contactPerson?: string;
}): Promise<Supplier> =>
  api.post('/admin/suppliers', data).then((r) => r.data);

export const updateAdminSupplier = (id: string, data: Partial<Omit<Supplier, 'id' | 'orderCount'>>): Promise<Supplier> =>
  api.put(`/admin/suppliers/${id}`, data).then((r) => r.data);

export const deleteAdminSupplier = (id: string): Promise<void> =>
  api.delete(`/admin/suppliers/${id}`).then(() => undefined);

export const toggleSupplierActive = (id: string): Promise<Supplier> =>
  api.patch(`/admin/suppliers/${id}/toggle-active`).then((r) => r.data);

export const setSupplierExclusive = (id: string): Promise<Supplier> =>
  api.patch(`/admin/suppliers/${id}/set-exclusive`).then((r) => r.data);

// ---- Store Orders (types) ----

export interface StoreOrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitCostPrice: number;
  unitClientPrice: number | null;
  selectedImageIds: string[];
  imageNotes: Record<string, string>;
  productOptions: Record<string, unknown>;
  product: {
    name: string;
    type: string;
    sku: string | null;
    specs: Record<string, unknown>;
    imagePreviewPath: string | null;
  };
}

export interface StoreOrder {
  id: string;
  adminId: string;
  clientId: string;
  galleryId: string;
  supplierId: string | null;
  flow: 'photographer' | 'client';
  status: 'draft' | 'pending_selection' | 'selection_submitted' | 'approved' | 'sent_to_supplier' | 'in_production' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'not_required' | 'pending' | 'paid' | 'refunded';
  totalAmount: number | null;
  currency: string;
  selectionToken: string | null;
  clientNote: string | null;
  photographerNote: string | null;
  supplierNote: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippingAddress: {
    name?: string;
    street?: string;
    apartment?: string;
    city?: string;
    zip?: string;
    country?: string;
    phone?: string;
  } | null;
  sentToSupplierAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { name: string; email: string; phone: string | null; addressStreet?: string; addressCity?: string; addressZip?: string; addressCountry?: string; addressApartment?: string };
  gallery: { name: string };
  supplier: { name: string } | null;
  items: StoreOrderItem[];
  itemsCount?: number;
}

export interface StoreOrdersResponse {
  orders: StoreOrder[];
  total: number;
  page: number;
  limit: number;
}

export interface GalleryImageForSelection {
  id: string;
  filename: string;
  path: string;
  thumbnailPath: string;
  sortOrder: number;
}

export interface OrderSelectionData {
  order: StoreOrder;
  galleryImages: GalleryImageForSelection[];
}

// ---- Store Orders — Photographer API ----

export const getOrders = (params?: { clientId?: string; galleryId?: string; status?: string; flow?: string; page?: number; limit?: number }) =>
  api.get<StoreOrdersResponse>('/orders', { params }).then((r) => r.data);

export const getOrder = (id: string) =>
  api.get<StoreOrder>(`/orders/${id}`).then((r) => r.data);

export const createOrder = (data: { clientId: string; galleryId: string; items: { productId: string; quantity: number; productOptions?: Record<string, unknown> }[]; photographerNote?: string }) =>
  api.post<StoreOrder>('/orders', data).then((r) => r.data);

export const updateOrderDraft = (id: string, data: { photographerNote?: string; items?: { productId: string; quantity: number; productOptions?: Record<string, unknown> }[] }) =>
  api.put<StoreOrder>(`/orders/${id}`, data).then((r) => r.data);

export const deleteOrder = (id: string) =>
  api.delete(`/orders/${id}`).then((r) => r.data);

export const sendOrderToClient = (id: string) =>
  api.post<StoreOrder>(`/orders/${id}/send-to-client`).then((r) => r.data);

export const approveOrder = (id: string) =>
  api.post<StoreOrder>(`/orders/${id}/approve`).then((r) => r.data);

export const sendOrderToSupplier = (id: string) =>
  api.post<StoreOrder>(`/orders/${id}/send-to-supplier`).then((r) => r.data);

export const cancelOrder = (id: string) =>
  api.post(`/orders/${id}/cancel`).then((r) => r.data);

// ---- Store Orders — Public client selection ----

export const getOrderSelection = (token: string) =>
  api.get<OrderSelectionData>(`/orders/selection/${token}`).then((r) => r.data);

export const submitOrderSelection = (token: string, data: {
  items: { orderItemId: string; selectedImageIds: string[]; imageNotes?: Record<string, string> }[];
  shippingAddress: { name: string; street: string; apartment?: string; city: string; zip?: string; country?: string; phone?: string };
  clientNote?: string;
}) => api.post(`/orders/selection/${token}`, data).then((r) => r.data);

// ---- Store Orders — Supplier API ----

export const getSupplierOrders = (params?: { status?: string; page?: number; limit?: number }) =>
  api.get<StoreOrdersResponse>('/supplier/orders', { params }).then((r) => r.data);

export const getSupplierOrder = (id: string) =>
  api.get<StoreOrder>(`/supplier/orders/${id}`).then((r) => r.data);

export const updateSupplierOrderStatus = (id: string, data: { status: string; trackingNumber?: string; trackingCarrier?: string; supplierNote?: string }) =>
  api.put<StoreOrder>(`/supplier/orders/${id}/status`, data).then((r) => r.data);

export const getSupplierOrderDownloadUrls = (id: string) =>
  api.get<{ urls: string[] }>(`/supplier/orders/${id}/images/download`).then((r) => r.data);

// ---- Store Public (client self-service, Flow B) ----

// Store product (public view for clients — uses client_price not cost_price)
export interface StoreProduct {
  id: string;
  name: string;
  type: string;
  description: string | null;
  sku: string | null;
  specs: Record<string, unknown>;
  clientPrice: number;
  imagePreviewPath: string | null;
  sortOrder: number;
}

export interface StoreProductsResponse {
  supplierId: string;
  supplierName: string;
  products: StoreProduct[];
}

export interface StoreCheckoutItem {
  productId: string;
  quantity: number;
  selectedImageIds: string[];
  imageNotes?: Record<string, string>;
  productOptions?: Record<string, unknown>;
}

export interface StoreCheckoutRequest {
  items: StoreCheckoutItem[];
  shippingAddress: {
    name: string;
    street: string;
    apartment?: string;
    city: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  clientNote?: string;
}

export interface StoreCheckoutResponse {
  orderId: string;
  url: string;
}

export interface StoreOrderStatus {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmount: number | null;
  currency: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  createdAt: string;
}

export const getStoreProducts = (galleryToken: string) =>
  api.get<StoreProductsResponse>(`/store/products/${galleryToken}`).then((r) => r.data);

export const storeCheckout = (galleryToken: string, data: StoreCheckoutRequest) =>
  api.post<StoreCheckoutResponse>(`/store/${galleryToken}/checkout`, data).then((r) => r.data);

export const getStoreOrderStatus = (orderId: string) =>
  api.get<StoreOrderStatus>(`/store/orders/${orderId}/status`).then((r) => r.data);
