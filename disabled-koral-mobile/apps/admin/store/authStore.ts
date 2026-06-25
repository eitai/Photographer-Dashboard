import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin, getMe, setToken, clearToken, getToken, eventBus } from '@koral/api';
import type { Admin } from '@koral/types';

const TOKEN_KEY = 'koral_auth_token';

interface AuthState {
  token: string | null;
  admin: Admin | null;
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
  /**
   * Called once on app boot — reads the persisted token from expo-secure-store
   * and hydrates state. Trusts the stored token without a round-trip to the server;
   * a 401 from any subsequent API call will trigger an automatic logout.
   */
  initialize(): Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Subscribe to the mitt logout event emitted by @koral/api on 401
  eventBus.on('logout', () => {
    get().logout();
  });

  return {
    token: null,
    admin: null,
    isLoading: true,

    async login(email, password) {
      const { token, admin } = await apiLogin(email, password);
      await setToken(token);
      set({ token, admin });
    },

    logout() {
      clearToken();
      set({ token: null, admin: null });
    },

    async initialize() {
      set({ isLoading: true });
      try {
        const token = await getToken();
        if (token) {
          set({ token });
          // Fetch admin profile so role-based guards work immediately.
          // A 401 triggers the eventBus logout handler above.
          const admin = await getMe();
          set({ admin });
        }
      } catch {
        // getMe failed (expired token, network error) — logout will fire via 401 event
      } finally {
        set({ isLoading: false });
      }
    },
  };
});
