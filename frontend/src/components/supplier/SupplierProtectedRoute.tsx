import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSupplierStore } from '@/store/supplierStore';
import { getSupplierMe } from '@/lib/api';

export const SupplierProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { setSupplier } = useSupplierStore();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupplierMe()
      .then(({ supplier }) => { setSupplier(supplier); setVerified(true); })
      .catch(() => { setSupplier(null); setVerified(false); })
      .finally(() => setLoading(false));
  }, [setSupplier]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <div
          className='w-8 h-8 border-2 border-t-transparent rounded-full animate-spin'
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!verified) return <Navigate to='/supplier/login' replace />;
  return <>{children}</>;
};
