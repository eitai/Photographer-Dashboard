import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL;

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

// Handle 401 — clear local user state and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearAuthAndRedirect();
    }
    return Promise.reject(err);
  }
);

// ---- Auth ----
export const verifyAuth = (): Promise<{ admin: import('@/store/authStore').AdminUser }> =>
  api.get('/auth/me').then((r) => r.data);

// ---- Storage ----
export const getMyStorage = (): Promise<import('@/types/admin').StorageStats> =>
  api.get('/storage/me').then((r) => r.data);

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

export default api;
