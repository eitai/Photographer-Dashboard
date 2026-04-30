import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Resolve a stored image/video path to a fully-qualified URL.
 *
 * Three formats are handled:
 *
 *  1. S3 key  (new format)  — "admins/<id>/file.jpg"
 *     → routed through /api/media/<key> which generates a presigned URL
 *       and redirects 302. Transparent to <img>, <video>, fetch, etc.
 *
 *  2. Legacy full S3 URL — "https://bucket.s3.amazonaws.com/admins/..."
 *     → key is extracted from the URL and routed the same way.
 *
 *  3. Local /uploads/... path (dev with S3 disabled)
 *     → backend URL is prepended; served directly as a static file.
 */
export const getImageUrl = (path: string): string => {
  if (!path) return '';
  // Local static file (dev, S3 not configured)
  if (path.startsWith('/')) return `${API_BASE}${path}`;
  // Legacy full S3 URL — extract key after ".amazonaws.com/"
  if (path.startsWith('https://') && path.includes('.amazonaws.com/')) {
    const key = path.split('.amazonaws.com/').pop();
    if (key) return `${API_BASE}/api/media/${key}`;
  }
  // New format: raw S3 key (e.g. "admins/<id>/file.jpg")
  return `${API_BASE}/api/media/${path}`;
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
  api.get('/storage/me').then((r) => r.data);

export const getAdminStorage = (adminId: string): Promise<import('@/types/admin').StorageStats> =>
  api.get(`/admins/${adminId}/storage`).then((r) => r.data);

export const setAdminQuota = (adminId: string, quotaGB: number): Promise<{ adminId: string; quotaBytes: number; quotaGB: number }> =>
  api.patch(`/admins/${adminId}/quota`, { quotaGB }).then((r) => r.data);

export default api;
