import { Navigate } from 'react-router-dom';
import { useAuth, useVerifyAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';

export const ProtectedRoute = ({ children, superadminOnly = false }: { children: React.ReactNode; superadminOnly?: boolean }) => {
  const { admin, loading } = useAuth();
  const { isVerifying } = useVerifyAuth();
  const { t } = useI18n();

  // Block rendering only when we have no admin data at all (cold page load with
  // no localStorage cache). If admin is already set (just logged in, or from
  // the localStorage cache) render immediately — the /auth/me verification runs
  // in the background and will overwrite stale data if the token has changed.
  if (loading || (!admin && isVerifying)) return <div className="min-h-screen flex items-center justify-center text-warm-gray">{t('admin.common.loading')}</div>;

  // admin is null only after the server ping has settled — a missing or expired
  // cookie surfaces as a 401 which clears the store via clearAuthAndRedirect().
  // If we reach this line with admin === null, the cookie was never present.
  if (!admin) return <Navigate to="/admin" replace />;

  // Regular admin cannot access superadmin-only routes.
  // The role value here comes from the server-verified /auth/me response, not
  // raw localStorage, so it cannot be escalated by a client-side edit.
  if (superadminOnly && admin.role !== 'superadmin') return <Navigate to="/admin/dashboard" replace />;

  return <>{children}</>;
}
