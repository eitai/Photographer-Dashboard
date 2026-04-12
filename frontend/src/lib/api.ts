import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

export default api;
