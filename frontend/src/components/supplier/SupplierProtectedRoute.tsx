import { Navigate } from 'react-router-dom';
import { useSupplierStore } from '@/store/supplierStore';

export const SupplierProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const supplier = useSupplierStore((s) => s.supplier);
  if (!supplier) return <Navigate to='/supplier/login' replace />;
  return <>{children}</>;
};
