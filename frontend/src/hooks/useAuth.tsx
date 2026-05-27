import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, type AdminUser } from '@/store/authStore';
import { verifyAuth } from '@/lib/api';

export function useAuth() {
  return useAuthStore();
}

/**
 * Verifies the session cookie against the server on mount.
 *
 * Use this hook once inside ProtectedRoute. It:
 *   1. Returns `isVerifying: true` while the ping is in-flight so the caller
 *      can show a spinner instead of rendering protected content.
 *   2. On success, writes the server-authoritative AdminUser back into the
 *      store, overwriting any tampered koral_admin_user localStorage value.
 *   3. On 401, the Axios response interceptor calls clearAuthAndRedirect()
 *      automatically — no extra error handling is needed here.
 *
 * The localStorage cache still provides optimistic hydration so there is no
 * blank-screen flash before the ping resolves.
 */
export function useVerifyAuth(): { isVerifying: boolean; queryAdmin: AdminUser | null } {
  const setAdmin = useAuthStore((s) => s.setAdmin);

  const { isFetching, isPending, data } = useQuery({
    queryKey: ['auth', 'me'] as const,
    queryFn: verifyAuth,
    staleTime: Infinity,
    retry: false,
  });

  // Sync the server-authoritative user into the Zustand store so the rest of
  // the app (sidebar, profile, etc.) can read it without going through React Query.
  useEffect(() => {
    if (data?.admin) {
      setAdmin(data.admin);
    }
  }, [data, setAdmin]);

  // isPending = no data in cache yet (true from render #1 before the fetch starts).
  // isFetching = network request actively in-flight.
  // queryAdmin is returned synchronously so ProtectedRoute can use it on the same
  // render that data arrives — before the useEffect above updates the Zustand store.
  return {
    isVerifying: isPending || isFetching,
    queryAdmin: data?.admin ?? null,
  };
}
