import { useState } from 'react';
import { deleteProductOrder, type ProductOrder } from '@/services/productOrderService';
import { ProductOrderCardHeader } from './ProductOrderCardHeader';
import { ProductOrderGalleries } from './ProductOrderGalleries';
import { ProductOrderLink } from './ProductOrderLink';
import { ProductOrderPhotos } from './ProductOrderPhotos';
import { useI18n } from '@/lib/i18n';
import type { Gallery } from '@/types/gallery';

interface Props {
  order: ProductOrder;
  clientId: string;
  galleries: Gallery[];
  refetch: () => void;
}

const borderByStatus: Record<string, string> = {
  submitted: 'border-amber-300 hover:border-amber-400',
  delivered: 'border-green-300 hover:border-green-400',
};

export const ProductOrderCard = ({ order, clientId, galleries, refetch }: Props) => {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProductOrder(order._id);
      refetch();
    } catch { /* ignore */ }
    finally { setDeleting(false); setConfirmCancel(false); }
  };

  const borderClass = borderByStatus[order.status] ?? 'border-beige hover:border-blush/40';

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-sm ${borderClass}`}>
      <div className='divide-y divide-beige'>
        <ProductOrderCardHeader
          order={order}
          clientId={clientId}
          onDelete={() => setConfirmCancel(true)}
          deleting={deleting}
        />

        {/* Inline cancel confirmation */}
        {confirmCancel && (
          <div className='px-4 py-3 bg-rose-50 flex items-center justify-between gap-3'>
            <p className='text-xs text-rose-700 font-medium'>
              {t('admin.products.cancel_confirm') || 'Cancel this order?'}
            </p>
            <div className='flex items-center gap-2 shrink-0'>
              <button
                onClick={() => setConfirmCancel(false)}
                className='text-xs text-warm-gray hover:text-charcoal transition-colors cursor-pointer'
              >
                {t('admin.common.no')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className='text-xs px-3 py-1 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-60 cursor-pointer'
              >
                {deleting ? '…' : t('admin.common.yes_cancel') || 'Yes, cancel'}
              </button>
            </div>
          </div>
        )}
        <ProductOrderGalleries order={order} clientId={clientId} galleries={galleries} />
        <ProductOrderLink order={order} refetch={refetch} />
        <ProductOrderPhotos order={order} />
      </div>
    </div>
  );
};
