import { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';

// No-op provider — kept for backwards compatibility with App.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return useAuthStore();
}
