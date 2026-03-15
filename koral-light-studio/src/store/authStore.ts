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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAdmin: (admin: AdminUser) => void;
  setTheme: (theme: string) => void;
}

// Restore admin profile from localStorage for immediate UI render.
// The actual auth token is an httpOnly cookie — the browser manages it.
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
    const { admin: adminData } = res.data;
    // Token is set as httpOnly cookie by the server — never touches JS
    localStorage.setItem('koral_admin_user', JSON.stringify(adminData));
    set({ admin: adminData });
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
