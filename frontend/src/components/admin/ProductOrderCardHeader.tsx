import { useState } from 'react';
import { Trash2, Check, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { sendProductOrderToSupplier, type ProductOrder } from '@/services/productOrderService';
import { useDeliverProductOrder, queryKeys, useClient, useUpdateClient } from '@/hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { SendToSupplierModal, type AddressData } from '@/components/admin/SendToSupplierModal';

interface Props {
  order: ProductOrder;
  clientId: string;
  onDelete: () => void;
  deleting: boolean;
}

const StatusBadge = ({ status, t }: { status: string; t: (k: string) => string }) => (
  <span
    className={`text-[11px] px-2 py-0.5 rounded-full ${
      status === 'submitted'
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : status === 'delivered'
        ? 'bg-green-50 text-green-700 border border-green-200'
        : 'bg-ivory text-warm-gray border border-beige'
    }`}
  >
    {status === 'submitted'
      ? t('admin.products.status_submitted')
      : status === 'delivered'
      ? t('admin.products.status_delivered')
      : t('admin.products.status_pending')}
  </span>
);

export const ProductOrderCardHeader = ({ order, clientId, onDelete, deleting }: Props) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const deliverOrder = useDeliverProductOrder(clientId);
  const updateClient = useUpdateClient(clientId);
  const { data: client } = useClient(clientId);

  const [delivering, setDelivering] = useState(false);
  const [sendingToSupplier, setSendingToSupplier] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const typeLabel = order.type === 'album' ? t('admin.products.type_album') : t('admin.products.type_print');

  const hasAddress = !!(client?.addressStreet || client?.addressCity);

  const handleDeliver = async () => {
    setDelivering(true);
    try {
      await deliverOrder.mutateAsync(order._id);
    } catch { /* ignore */ }
    finally { setDelivering(false); }
  };

  const handleModalConfirm = async ({
    photographerNote,
    address,
  }: {
    photographerNote?: string;
    address?: AddressData;
  }) => {
    setSendingToSupplier(true);
    try {
      // If the modal collected a new address, persist it to the client first
      if (address) {
        await updateClient.mutateAsync({
          addressStreet: address.addressStreet,
          addressApartment: address.addressApartment ?? null,
          addressCity: address.addressCity,
          addressZip: address.addressZip ?? null,
          addressCountry: address.addressCountry ?? null,
        });
      }

      const result = await sendProductOrderToSupplier(order._id, { photographerNote });
      queryClient.setQueryData<ProductOrder[]>(
        queryKeys.productOrders(clientId),
        (prev) => prev?.map((o) => o._id === order._id ? { ...o, storeOrderId: result.storeOrderId } : o),
      );
      toast.success(t('orders.action.send_to_supplier') + ' ✓');
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not send to supplier');
    } finally {
      setSendingToSupplier(false);
    }
  };

  return (
    <>
      <div className='px-4 py-3 flex items-start gap-2'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 flex-wrap'>
            <span className='font-medium text-sm text-charcoal'>{order.name}</span>
            <span className='text-[11px] bg-ivory text-warm-gray border border-beige px-2 py-0.5 rounded-full'>
              {typeLabel}
            </span>
            <StatusBadge status={order.status} t={t} />
          </div>
          <p className='text-xs text-warm-gray mt-1'>
            {order.maxPhotos} {t('admin.products.max_photos')}
          </p>
          {order.status === 'submitted' && (
            <div className='mt-1.5 flex items-center gap-2 flex-wrap'>
              <button
                onClick={handleDeliver}
                disabled={delivering}
                className='flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-60 cursor-pointer'
              >
                <Check size={10} />
                {delivering ? t('admin.common.saving') : t('admin.products.mark_delivered')}
              </button>
              {order.selectedPhotoIds.length > 0 && (
                order.storeOrderId ? (
                  <span className='flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200'>
                    <Check size={10} />
                    {t('orders.status.sent_to_supplier')}
                  </span>
                ) : (
                  <button
                    onClick={() => setModalOpen(true)}
                    disabled={sendingToSupplier}
                    className='flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-ivory text-warm-gray border border-beige hover:border-blush hover:text-charcoal transition-colors disabled:opacity-60 cursor-pointer'
                  >
                    <Send size={10} />
                    {t('orders.action.send_to_supplier')}
                  </button>
                )
              )}
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className='shrink-0 text-warm-gray hover:text-red-500 transition-colors disabled:opacity-50 ms-auto cursor-pointer'
          title={t('admin.products.delete')}
        >
          {deleting ? <span className='text-xs'>{t('admin.common.deleting')}</span> : <Trash2 size={15} />}
        </button>
      </div>

      <SendToSupplierModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleModalConfirm}
        clientName={client?.name ?? ''}
        hasAddress={hasAddress}
        orderName={order.name}
        isSending={sendingToSupplier}
      />
    </>
  );
};
