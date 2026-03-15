import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';

export const ProtectedRoute = ({ children, superadminOnly = false }: { children: React.ReactNode; superadminOnly?: boolean }) => {
  const { admin, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-warm-gray">{t('admin.common.loading')}</div>;
  if (!admin) return <Navigate to="/admin" replace />;
  // Superadmin can only access /admin/users
  if (admin.role === 'superadmin' && !superadminOnly) return <Navigate to="/admin/users" replace />;
  // Regular admin cannot access superadmin-only routes
  if (superadminOnly && admin.role !== 'superadmin') return <Navigate to="/admin/dashboard" replace />;
  return <>{children}</>;
}
