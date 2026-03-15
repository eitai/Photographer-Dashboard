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
  logout: () => void;
  setAdmin: (admin: AdminUser) => void;
  setTheme: (theme: string) => void;
}

// Synchronous init from localStorage — no async needed
const _token = localStorage.getItem('koral_admin_token');
const _stored = localStorage.getItem('koral_admin_user');
let _initialAdmin: AdminUser | null = null;
if (_token && _stored) {
  try {
    _initialAdmin = JSON.parse(_stored);
  } catch {
    localStorage.removeItem('koral_admin_token');
    localStorage.removeItem('koral_admin_user');
  }
}
const _initialTheme = localStorage.getItem('koral_admin_theme') || 'bw';

export const useAuthStore = create<AuthState>((set) => ({
  admin: _initialAdmin,
  loading: false,
  theme: _initialTheme,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, admin: adminData } = res.data;
    localStorage.setItem('koral_admin_token', token);
    localStorage.setItem('koral_admin_user', JSON.stringify(adminData));
    set({ admin: adminData });
  },

  logout: () => {
    localStorage.removeItem('koral_admin_token');
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
