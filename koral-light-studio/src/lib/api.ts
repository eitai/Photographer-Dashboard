import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
  // Required for the browser to send/receive httpOnly cookies cross-origin
  withCredentials: true,
});

function clearAuthAndRedirect() {
  localStorage.removeItem('koral_admin_user');
  window.location.href = '/admin';
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

export default api;
