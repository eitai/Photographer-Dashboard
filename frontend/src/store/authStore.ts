import { create } from 'zustand';
import api from '@/lib/api';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'superadmin';
  username: string | null;
  studioName: string | null;
}

interface AuthState {
  admin: AdminUser | null;
  loading: boolean;
  theme: string;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  setAdmin: (admin: AdminUser) => void;
  setTheme: (theme: string) => void;
}

// Restore the cached admin profile from localStorage for an optimistic,
// flicker-free render before the /auth/me server ping resolves.
//
// Auth is cookie-first: the server sets an httpOnly cookie named koral_token
// on login. The browser attaches it to every request automatically (via
// withCredentials: true on the Axios instance) — it never touches JavaScript.
//
// koral_admin_user  — UI-only cache of the AdminUser profile object (name,
//                     email, role). Used here to hydrate the store instantly.
//                     Always overwritten with the server response once
//                     /auth/me resolves, so a tampered value is short-lived.
//
// koral_admin_token — Legacy key. Never written by current code; removed by
//                     clearAuthAndRedirect() for cleanup only.
const _stored = localStorage.getItem('koral_admin_user');
let _initialAdmin: AdminUser | null = null;
if (_stored) {
  try {
    _initialAdmin = JSON.parse(_stored);
  } catch {
    localStorage.removeItem('koral_admin_user');
  }
}
const _initialTheme = localStorage.getItem('koral_admin_theme') || 'bw';

export const useAuthStore = create<AuthState>((set) => ({
  admin: _initialAdmin,
  loading: false,
  theme: _initialTheme,

  login: async (email, password) => {
    const payload = email.includes('@') ? { email, password } : { username: email, password };
    const res = await api.post('/auth/login', payload);
    const { admin: adminData } = res.data as { admin: AdminUser };
    // The server sets the httpOnly koral_token cookie in the Set-Cookie header.
    // We never receive or store the token value in JS.
    // koral_admin_user caches the profile object for optimistic UI hydration.
    localStorage.setItem('koral_admin_user', JSON.stringify(adminData));
    set({ admin: adminData });
    return adminData;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort — clear local state regardless
    }
    localStorage.removeItem('koral_admin_user');
    set({ admin: null });
  },

  setAdmin: (adminData: AdminUser) => {
    localStorage.setItem('koral_admin_user', JSON.stringify(adminData));
    set({ admin: adminData });
  },

  setTheme: (theme: string) => {
    localStorage.setItem('koral_admin_theme', theme);
    set({ theme });
  },
}));
