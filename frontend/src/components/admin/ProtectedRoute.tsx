import { Navigate } from 'react-router-dom';
import { useAuth, useVerifyAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';

export const ProtectedRoute = ({ children, superadminOnly = false }: { children: React.ReactNode; superadminOnly?: boolean }) => {
  const { admin: storeAdmin, loading } = useAuth();
  const { isVerifying, queryAdmin } = useVerifyAuth();
  const { t } = useI18n();

  // Prefer the Zustand store (optimistic hydration from localStorage) but fall
  // back to the raw query result for the render where data first arrives.
  // useVerifyAuth syncs the store via useEffect — which runs *after* the render —
  // so without this fallback there is a render where isVerifying=false and
  // storeAdmin=null, causing a premature redirect to /admin.
  const admin = storeAdmin ?? queryAdmin;

  if (loading || (!admin && isVerifying)) return <div className="min-h-screen flex items-center justify-center text-warm-gray">{t('admin.common.loading')}</div>;
  if (!admin) return <Navigate to="/admin" replace />;
  if (superadminOnly && admin.role !== 'superadmin') return <Navigate to="/admin/dashboard" replace />;

  return <>{children}</>;
}
