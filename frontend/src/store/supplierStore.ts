import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Supplier } from '@/lib/api';

interface SupplierState {
  supplier: Supplier | null;
  setSupplier: (s: Supplier | null) => void;
}

export const useSupplierStore = create<SupplierState>()(
  persist(
    (set) => ({
      supplier: null,
      setSupplier: (supplier) => set({ supplier }),
    }),
    { name: 'koral_supplier_user' },
  ),
);
