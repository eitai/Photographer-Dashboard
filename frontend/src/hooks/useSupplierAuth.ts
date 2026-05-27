import { useSupplierStore } from '@/store/supplierStore';
import { supplierLogin, supplierLogout } from '@/lib/api';

export function useSupplierAuth() {
  const { supplier, setSupplier } = useSupplierStore();

  const login = async (email: string, password: string) => {
    const res = await supplierLogin(email, password);
    setSupplier(res.supplier);
    return res.supplier;
  };

  const logout = async () => {
    await supplierLogout().catch(() => {});
    setSupplier(null);
  };

  return { supplier, login, logout };
}
