import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
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
export function useVerifyAuth(): { isVerifying: boolean } {
  const setAdmin = useAuthStore((s) => s.setAdmin);

  const { isFetching, data } = useQuery({
    queryKey: ['auth', 'me'] as const,
    queryFn: verifyAuth,
    // One-shot session check per page load.
    // Subsequent 401s on any other request will trigger clearAuthAndRedirect.
    staleTime: Infinity,
    retry: false,
  });

  // Write the server result back into the store once the ping resolves.
  // This overwrites any tampered localStorage value with the real server user.
  useEffect(() => {
    if (data?.admin) {
      setAdmin(data.admin);
    }
  }, [data, setAdmin]);

  return { isVerifying: isFetching };
}
