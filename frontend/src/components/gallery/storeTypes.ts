import type { StoreProduct } from '@/lib/api';

export type StoreView = 'products' | 'configure' | 'cart' | 'checkout';

export interface CartItem {
  product: StoreProduct;
  quantity: number;
  selectedImageIds: string[];
  imageNotes: Record<string, string>;
  productOptions: Record<string, string>;
}

export interface ShippingFormState {
  name: string;
  street: string;
  apartment: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
}

export interface ShippingErrors {
  name?: string;
  street?: string;
  city?: string;
}

export function formatPrice(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
