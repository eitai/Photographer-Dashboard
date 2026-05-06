import { create } from 'zustand';
import api from '@/lib/api';
import { queryClient } from '@/App';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'superadmin';
  username: string | null;
  studioName: string | null;
  ssoEnabled: boolean;
  firstLogin: boolean;
  googleEmail: string | null;
}

interface AuthState {
  admin: AdminUser | null;
  loading: boolean;
  theme: string;
  darkMode: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  setAdmin: (admin: AdminUser) => void;
  setTheme: (theme: string) => void;
  setDarkMode: (v: boolean) => void;
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
// If this page load is the result of an SSO callback, the previous admin's
// localStorage cache is stale — ignore it so ProtectedRoute waits for the
// server-verified /auth/me response before rendering.
const _ssoLanding = new URLSearchParams(window.location.search).get('sso') === 'success';
if (_ssoLanding) {
  localStorage.removeItem('koral_admin_user');
  // Force useVerifyAuth to re-fetch /auth/me instead of using a stale cache
  // from the previous session — otherwise isFetching stays false, ProtectedRoute
  // sees admin=null+isVerifying=false, and redirects back to login immediately.
  queryClient.removeQueries({ queryKey: ['auth', 'me'] });
}

const _stored = _ssoLanding ? null : localStorage.getItem('koral_admin_user');
let _initialAdmin: AdminUser | null = null;
if (_stored) {
  try {
    const parsed = JSON.parse(_stored);
    // Backfill optional SSO fields that may be absent in older cached objects
    _initialAdmin = {
      ssoEnabled: false,
      firstLogin: false,
      googleEmail: null,
      ...parsed,
    };
  } catch {
    localStorage.removeItem('koral_admin_user');
  }
}
const _initialTheme = localStorage.getItem('koral_admin_theme') || 'bw';
const _initialDarkMode = localStorage.getItem('koral_admin_dark') === 'true';

export const useAuthStore = create<AuthState>((set) => ({
  admin: _initialAdmin,
  loading: false,
  theme: _initialTheme,
  darkMode: _initialDarkMode,

  login: async (email, password) => {
    const payload = email.includes('@') ? { email, password } : { username: email, password };
    const res = await api.post('/auth/login', payload);
    const { admin: adminData } = res.data as { admin: AdminUser };
    // Clear stale cache from a previous session AFTER the new credentials arrive,
    // not before — clearing before the POST was causing in-flight /auth/me requests
    // (aborted during logout) to race with the login and trigger clearAuthAndRedirect.
    queryClient.clear();
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
    // Clear the React Query cache so a subsequent login as a different user
    // does not see this user's cached data (galleries, settings, auth/me, etc.).
    queryClient.clear();
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

  setDarkMode: (v: boolean) => {
    localStorage.setItem('koral_admin_dark', String(v));
    set({ darkMode: v });
  },
}));
