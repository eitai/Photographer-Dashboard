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
  let role: string | null = null;
  try { role = JSON.parse(localStorage.getItem('koral_admin_user') ?? '').role; } catch { /* no cached user */ }
  localStorage.removeItem('koral_admin_token');
  localStorage.removeItem('koral_admin_user');
  window.location.replace(role === 'superadmin' ? '/admin' : '/login');
}

// Handle 401 — clear local user state and redirect to login.
// Skip cancelled requests: when queryClient.clear() aborts an in-flight /auth/me
// during logout, we don't want that stale 401 to interrupt a concurrent login.
// Supplier endpoints get their own redirect so they don't land on the admin login page.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ERR_CANCELED') return Promise.reject(err);
    if (err.response?.status === 401) {
      const url: string = (err.config?.url ?? '') + (err.config?.baseURL ?? '');
      const isSupplierRequest = url.includes('supplier');
      if (isSupplierRequest) {
        if (window.location.pathname !== '/supplier/login') {
          window.location.replace('/supplier/login');
        }
      } else {
        clearAuthAndRedirect();
      }
    }
    return Promise.reject(err);
  }
);

// ---- Auth ----
// Accepts the AbortSignal from React Query so the request is properly cancelled
// when queryClient.clear() is called (e.g. on logout).
export const verifyAuth = ({ signal }: { signal: AbortSignal }): Promise<{ admin: import('@/store/authStore').AdminUser }> =>
  api.get('/auth/me', { signal }).then((r) => r.data);

export const registerPhotographer = (data: {
  name: string;
  studioName?: string;
  email: string;
  password: string;
}): Promise<{ admin: import('@/store/authStore').AdminUser }> =>
  api.post('/auth/register', data).then((r) => r.data);

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

export const overrideAdminSubscription = (adminId: string, data: { planId: string; billingInterval?: string; customStorageGb?: number }) =>
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
  minPhotos: number;
  maxPhotos: number;
  productionDays: number | null;
  variations: { name: string; options: string[] }[];
}

export const supplierLogin = (email: string, password: string): Promise<{ supplier: Supplier }> =>
  api.post('/supplier/auth/login', { email, password }).then((r) => r.data);

export const supplierLogout = (): Promise<void> =>
  api.post('/supplier/auth/logout').then(() => undefined);

export const getSupplierMe = (): Promise<{ supplier: Supplier }> =>
  api.get('/supplier/auth/me').then((r) => r.data);

export const updateSupplierProfile = (data: { name?: string; phone?: string | null; contactPerson?: string | null }): Promise<{ supplier: Supplier }> =>
  api.patch('/supplier/auth/me', data).then((r) => r.data);

export const changeSupplierPassword = (currentPassword: string, newPassword: string): Promise<{ message: string }> =>
  api.post('/supplier/auth/change-password', { currentPassword, newPassword }).then((r) => r.data);

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
    minPhotos?: number;
    maxPhotos?: number;
    productionDays?: number | null;
    variations?: ProductVariation[];
  };
}

export interface ProductVariation {
  name: string;
  options: string[];
}

export interface StoreOrder {
  id: string;
  adminId: string;
  clientId: string | null;
  galleryId: string | null;
  supplierId: string | null;
  flow: 'photographer' | 'client';
  isDirect?: boolean;
  status: 'draft' | 'pending_selection' | 'selection_submitted' | 'approved' | 'sent_to_supplier' | 'in_production' | 'ready_to_ship' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'not_required' | 'pending' | 'paid' | 'refunded' | 'failed' | 'refund_pending';
  totalAmount: number | null;
  costTotal?: number;
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
  inProductionAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { name: string; email: string; phone: string | null; addressStreet?: string; addressCity?: string; addressZip?: string; addressCountry?: string; addressApartment?: string } | null;
  gallery: { name: string } | null;
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

export const getOrders = (params?: { clientId?: string; galleryId?: string; status?: string; flow?: string; from?: string; to?: string; page?: number; limit?: number }) =>
  api.get<StoreOrdersResponse>('/orders', { params }).then((r) => r.data);

export const getOrder = (id: string) =>
  api.get<StoreOrder>(`/orders/${id}`).then((r) => r.data);

export interface OrderReportRow {
  id: string;
  status: string;
  flow: string;
  totalAmount: number | null;
  currency: string;
  createdAt: string;
  photographerNote: string | null;
  clientName: string | null;
  galleryName: string | null;
  itemsCount: number;
}
export interface OrdersReport {
  rows: OrderReportRow[];
  summary: { count: number; totalAmount: number; byStatus: Record<string, { count: number; total: number }> };
  capped: boolean;
}
export const getOrdersReport = (params?: { status?: string; flow?: string; from?: string; to?: string }) =>
  api.get<OrdersReport>('/orders/report', { params }).then((r) => r.data);

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

// Get all active supplier products (for order creation dropdown + favorites picker).
// Favorites of the requesting admin sort first and carry isFavorite: true.
export type AdminSupplierProduct = SupplierProduct & { supplierName: string; isFavorite: boolean };

export const getAdminSupplierProducts = (): Promise<AdminSupplierProduct[]> =>
  api.get('/admin-products/supplier-products').then((r) => r.data);

// ---- Flow 3: photographer direct ordering ----

export interface DirectOrderItem {
  productId: string;
  quantity: number;
  selectedImageIds: string[];
  productOptions?: Record<string, string>;
}

export const createDirectOrder = (data: {
  items: DirectOrderItem[];
  shippingAddress: { name: string; street: string; apartment?: string; city: string; zip?: string; country?: string; phone?: string };
  photographerNote?: string;
}): Promise<StoreOrder> =>
  api.post('/orders/direct', data).then((r) => r.data);

export interface DirectUploadResult {
  galleryId: string;
  images: { id: string; filename: string; path: string; thumbnailPath: string | null; previewPath: string | null }[];
}

export const uploadDirectOrderImages = (
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<DirectUploadResult> => {
  const form = new FormData();
  files.forEach((f) => form.append('images', f));
  return api.post('/orders/direct/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  }).then((r) => r.data);
};

export const setSupplierProductFavorite = (productId: string, favorite: boolean): Promise<{ ok: boolean; isFavorite: boolean }> =>
  favorite
    ? api.post(`/admin-products/favorites/${productId}`).then((r) => r.data)
    : api.delete(`/admin-products/favorites/${productId}`).then((r) => r.data);

// ---- Billing (photographer) ----

export interface PhotographerInvoice {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  currency: string;
  status: 'pending_payment' | 'paid' | 'failed' | 'cancelled';
  dueAt: string | null;
  paidAt: string | null;
  payplusLink: string | null;
  createdAt: string;
}

export interface BillingMe {
  accrued: { total: number; count: number };
  invoices: PhotographerInvoice[];
  hasCardOnFile: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
  billingBlocked: boolean;
  canOrderSupplier: boolean;
}

export const getBillingMe = (): Promise<BillingMe> =>
  api.get('/billing/me').then((r) => r.data);

export const startAddCard = (): Promise<{ url: string }> =>
  api.post('/billing/card').then((r) => r.data);

// ---- Billing (superadmin) ----

export interface BillingOverviewRow {
  adminId: string;
  name: string;
  email: string;
  billingBlocked: boolean;
  hasCard: boolean;
  accrued: number;
  unpaidTotal: number;   // existing pending/failed invoices
  outstanding: number;   // accrued + unpaidTotal = total owed
  latestInvoice: { id: string; status: string; totalAmount: number; periodStart: string; dueAt: string | null } | null;
}

export const getBillingOverview = (): Promise<BillingOverviewRow[]> =>
  api.get('/admin/billing/overview').then((r) => r.data);

export const closeBillingCycle = (body?: { periodStart?: string; periodEnd?: string }): Promise<{ invoiced: number; paid: number; failed: number }> =>
  api.post('/admin/billing/close-cycle', body || {}).then((r) => r.data);

export const chargePhotographers = (adminIds?: string[]): Promise<{ invoiced: number; paid: number; failed: number }> =>
  api.post('/admin/billing/charge', adminIds && adminIds.length ? { adminIds } : {}).then((r) => r.data);

export const markInvoicePaid = (id: string): Promise<PhotographerInvoice> =>
  api.post(`/admin/billing/invoices/${id}/mark-paid`).then((r) => r.data);

export const unblockPhotographer = (adminId: string): Promise<{ ok: boolean }> =>
  api.post(`/admin/billing/admins/${adminId}/unblock`).then((r) => r.data);

export interface SettlementRow {
  supplierId: string;
  name: string;
  open: { total: number; orderCount: number };
  history: { id: string; periodStart: string; periodEnd: string; totalCost: number; orderCount: number; status: string; settledAt: string | null }[];
}

export const getSettlements = (): Promise<SettlementRow[]> =>
  api.get('/admin/billing/settlements').then((r) => r.data);

export interface BillingReport {
  period: { from: string | null; to: string | null };
  photographers: { adminId: string; name: string; email: string; paidInPeriod: number; accrued: number; unpaidTotal: number; outstanding: number }[];
  suppliers: { supplierId: string; name: string; openBalance: number; settledInPeriod: number }[];
  totals: { revenuePaid: number; revenuePending: number; revenueFailed: number; openAccrual: number; outstanding: number; supplierOwed: number; supplierSettled: number };
}
export const getBillingReport = (params?: { from?: string; to?: string }): Promise<BillingReport> =>
  api.get('/admin/billing/report', { params }).then((r) => r.data);

export const createSettlement = (supplierId: string): Promise<unknown> =>
  api.post('/admin/billing/settlements', { supplierId }).then((r) => r.data);

export const markSettlementSettled = (id: string, note?: string): Promise<unknown> =>
  api.post(`/admin/billing/settlements/${id}/settle`, { note }).then((r) => r.data);

// ---- Accounting documents (receipts / invoices) ----

export interface IssuedDocument {
  id: string;
  docType: 'receipt' | 'tax_invoice_receipt' | 'order_confirmation';
  amount: number;
  vatAmount: number;
  currency: string;
  status: 'pending' | 'issued' | 'failed' | 'skipped';
  documentNumber: string | null;
  pdfUrl: string | null;
  sourceKind: string;
  createdAt: string;
  issuedAt: string | null;
}

export const getMyDocuments = (): Promise<IssuedDocument[]> =>
  api.get('/billing/documents').then((r) => r.data);

export const getAllDocuments = (status?: string): Promise<IssuedDocument[]> =>
  api.get('/admin/billing/documents', { params: status ? { status } : {} }).then((r) => r.data);

export const backfillDocuments = (): Promise<{ issued?: number; failed?: number; total?: number; skipped?: boolean; reason?: string }> =>
  api.post('/admin/billing/documents/backfill').then((r) => r.data);

export const retryDocument = (id: string): Promise<IssuedDocument> =>
  api.post(`/admin/billing/documents/${id}/retry`).then((r) => r.data);

// Supplier's own settlement statement (read-only)
export interface SupplierSettlementView {
  open: { total: number; orderCount: number };
  history: { id: string; periodStart: string; periodEnd: string; totalCost: number; orderCount: number; status: string; settledAt: string | null }[];
}

export const getSupplierSettlement = (): Promise<SupplierSettlementView> =>
  api.get('/supplier/settlement').then((r) => r.data);

// Fetch a gallery's images for the direct-order photo picker
export interface AdminGalleryImage {
  id?: string;
  _id?: string;
  filename: string;
  path: string;
  thumbnailPath: string | null;
}

export const getGalleryImages = (galleryId: string): Promise<AdminGalleryImage[]> =>
  api.get(`/galleries/${galleryId}/images?limit=200`).then((r) => {
    const d = r.data;
    return Array.isArray(d) ? d : (d.images ?? []);
  });

// Manually notify client about current order status
export const notifyOrderClient = (id: string): Promise<{ ok: boolean }> =>
  api.post(`/orders/${id}/notify-client`).then((r) => r.data);

// ---- Store Orders — Public client selection ----

export const getOrderSelection = (token: string) =>
  api.get<OrderSelectionData>(`/orders/selection/${token}`).then((r) => r.data);

export const submitOrderSelection = (token: string, data: {
  items: { orderItemId: string; selectedImageIds: string[]; imageNotes?: Record<string, string> }[];
  shippingAddress: { name: string; street: string; apartment?: string; city: string; zip?: string; country?: string; phone?: string };
  clientNote?: string;
}) => api.post(`/orders/selection/${token}`, data).then((r) => r.data);

// ---- Store Orders — Supplier API ----

export const getSupplierOrders = (params?: { status?: string; from?: string; to?: string; page?: number; limit?: number }) =>
  api.get<StoreOrdersResponse>('/supplier/orders', { params }).then((r) => r.data);

export interface SupplierOrderReportRow {
  id: string;
  status: string;
  createdAt: string;
  currency: string;
  photographerName: string | null;
  studioName: string | null;
  itemsCount: number;
  costTotal: number;
}
export interface SupplierOrdersReport {
  rows: SupplierOrderReportRow[];
  summary: { count: number; totalToPay: number; byStatus: Record<string, { count: number; total: number }> };
  capped: boolean;
}
export const getSupplierOrdersReport = (params?: { status?: string; from?: string; to?: string }) =>
  api.get<SupplierOrdersReport>('/supplier/orders/report', { params }).then((r) => r.data);

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
  minPhotos: number;
  maxPhotos: number;
  productionDays: number | null;
  variations: { name: string; options: string[] }[];
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
  paymentStatus: 'not_required' | 'pending' | 'paid' | 'refunded' | 'failed' | 'refund_pending';
  totalAmount: number | null;
  currency: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  createdAt: string;
  receiptUrl?: string | null;
}

export const getStoreProducts = (galleryToken: string) =>
  api.get<StoreProductsResponse>(`/store/products/${galleryToken}`).then((r) => r.data);

export const storeCheckout = (galleryToken: string, data: StoreCheckoutRequest) =>
  api.post<StoreCheckoutResponse>(`/store/${galleryToken}/checkout`, data).then((r) => r.data);

export const getStoreOrderStatus = (orderId: string) =>
  api.get<StoreOrderStatus>(`/store/orders/${orderId}/status`).then((r) => r.data);
