import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import {
  useOrder,
  useSendOrderToClient,
  useApproveOrder,
  useSendOrderToSupplier,
  useCancelOrder,
  useDeleteOrder,
} from '@/hooks/useQueries';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { StoreOrder } from '@/lib/api';

const STATUS_COLORS: Record<StoreOrder['status'], string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  pending_selection: 'bg-yellow-100 text-yellow-700',
  selection_submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  sent_to_supplier: 'bg-purple-100 text-purple-700',
  in_production: 'bg-orange-100 text-orange-700',
  shipped: 'bg-sky-100 text-sky-700',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_STEPS: StoreOrder['status'][] = [
  'draft',
  'pending_selection',
  'selection_submitted',
  'approved',
  'sent_to_supplier',
  'in_production',
  'shipped',
  'delivered',
];

export const AdminOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const { toast } = useToast();

  const { data: order, isLoading } = useOrder(id ?? '');
  const sendToClient = useSendOrderToClient();
  const approve = useApproveOrder();
  const sendToSupplier = useSendOrderToSupplier();
  const cancel = useCancelOrder();
  const deleteOrder = useDeleteOrder();

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const handleAction = (
    mutation: { mutate: (id: string, opts: { onSuccess: () => void; onError: () => void }) => void },
    successMsg: string,
    errorMsg: string,
    afterSuccess?: () => void,
  ) => {
    if (!id) return;
    mutation.mutate(id, {
      onSuccess: () => {
        toast({ title: successMsg });
        afterSuccess?.();
      },
      onError: () => toast({ title: errorMsg, variant: 'destructive' }),
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className='p-6 space-y-4'>
          <Skeleton className='h-8 w-48' />
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <Skeleton className='h-64' />
            <div className='lg:col-span-2 space-y-4'>
              <Skeleton className='h-24' />
              <Skeleton className='h-48' />
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className='p-6 text-center text-warm-gray'>{t('admin.common.error')}</div>
      </AdminLayout>
    );
  }

  const currentStepIdx = STATUS_STEPS.indexOf(order.status);

  return (
    <AdminLayout>
      <div className='p-6 space-y-6'>
        {/* Back + title */}
        <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <Button variant='ghost' size='sm' onClick={() => navigate('/admin/orders')} className='gap-1'>
            <BackIcon size={16} />
            {dir === 'rtl' ? 'חזרה להזמנות' : 'Back to Orders'}
          </Button>
          <h1 className='font-serif text-xl text-charcoal'>
            {dir === 'rtl' ? `הזמנה #${order.id.slice(-6)}` : `Order #${order.id.slice(-6)}`}
          </h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
            {t(`orders.status.${order.status}`)}
          </span>
        </div>

        {/* Status timeline */}
        <div className='bg-white rounded-xl border border-border p-4 overflow-x-auto'>
          <div className={`flex items-center gap-1 min-w-max ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
            {STATUS_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const isFuture = idx > currentStepIdx;
              return (
                <div key={step} className={`flex items-center gap-1 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex flex-col items-center gap-1`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isCurrent ? 'bg-blush text-white' :
                      isPast ? 'bg-emerald-500 text-white' :
                      'bg-zinc-100 text-zinc-400'
                    }`}>
                      {isPast ? '✓' : idx + 1}
                    </div>
                    <span className={`text-xs whitespace-nowrap ${isFuture ? 'text-zinc-400' : 'text-charcoal'}`}>
                      {t(`orders.status.${step}`)}
                    </span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={`w-8 h-0.5 mb-4 ${isPast ? 'bg-emerald-400' : 'bg-zinc-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Two-column layout */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${dir === 'rtl' ? 'direction-rtl' : ''}`}>
          {/* Left sidebar */}
          <div className='space-y-4'>
            {/* Client card */}
            <div className='bg-white rounded-xl border border-border p-4 space-y-2'>
              <h3 className='font-medium text-charcoal text-sm'>{t('orders.client')}</h3>
              <p className='text-charcoal font-semibold'>{order.client.name}</p>
              <p className='text-warm-gray text-sm'>{order.client.email}</p>
              {order.client.phone && (
                <p className='text-warm-gray text-sm'>{order.client.phone}</p>
              )}
            </div>

            {/* Shipping address */}
            {order.shippingAddress && (
              <div className='bg-white rounded-xl border border-border p-4 space-y-1'>
                <h3 className='font-medium text-charcoal text-sm'>{t('orders.shipping')}</h3>
                {order.shippingAddress.name && <p className='text-charcoal text-sm'>{order.shippingAddress.name}</p>}
                {order.shippingAddress.street && (
                  <p className='text-warm-gray text-sm'>
                    {order.shippingAddress.street}
                    {order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ''}
                  </p>
                )}
                {order.shippingAddress.city && (
                  <p className='text-warm-gray text-sm'>
                    {order.shippingAddress.city}
                    {order.shippingAddress.zip ? ` ${order.shippingAddress.zip}` : ''}
                  </p>
                )}
                {order.shippingAddress.country && <p className='text-warm-gray text-sm'>{order.shippingAddress.country}</p>}
                {order.shippingAddress.phone && <p className='text-warm-gray text-sm'>{order.shippingAddress.phone}</p>}
              </div>
            )}

            {/* Order metadata */}
            <div className='bg-white rounded-xl border border-border p-4 space-y-2'>
              <div className={`flex justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                <span className='text-warm-gray text-sm'>{dir === 'rtl' ? 'זרימה' : 'Flow'}</span>
                <span className='text-sm font-medium'>{t(`orders.flow.${order.flow}`)}</span>
              </div>
              <div className={`flex justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                <span className='text-warm-gray text-sm'>{t('orders.created')}</span>
                <span className='text-sm'>{new Date(order.createdAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}</span>
              </div>
              {order.totalAmount != null && (
                <div className={`flex justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <span className='text-warm-gray text-sm'>{t('orders.total')}</span>
                  <span className='text-sm font-semibold text-charcoal'>₪{order.totalAmount.toLocaleString()}</span>
                </div>
              )}
              {order.supplier && (
                <div className={`flex justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <span className='text-warm-gray text-sm'>{t('orders.supplier')}</span>
                  <span className='text-sm'>{order.supplier.name}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className='space-y-2'>
              {order.status === 'draft' && (
                <>
                  <Button
                    className='w-full bg-blush hover:bg-blush/90 text-white'
                    onClick={() =>
                      handleAction(
                        sendToClient as Parameters<typeof handleAction>[0],
                        t('orders.action.send_to_client'),
                        t('admin.common.error'),
                      )
                    }
                    disabled={sendToClient.isPending}
                  >
                    {t('orders.action.send_to_client')}
                  </Button>
                  <Button
                    variant='outline'
                    className='w-full text-red-600 border-red-200 hover:bg-red-50'
                    onClick={() =>
                      handleAction(
                        deleteOrder as Parameters<typeof handleAction>[0],
                        t('orders.action.delete'),
                        t('admin.common.error'),
                        () => navigate('/admin/orders'),
                      )
                    }
                    disabled={deleteOrder.isPending}
                  >
                    {t('orders.action.delete')}
                  </Button>
                </>
              )}

              {order.status === 'selection_submitted' && (
                <Button
                  className='w-full bg-green-600 hover:bg-green-700 text-white'
                  onClick={() =>
                    handleAction(
                      approve as Parameters<typeof handleAction>[0],
                      t('orders.action.approve'),
                      t('admin.common.error'),
                    )
                  }
                  disabled={approve.isPending}
                >
                  {t('orders.action.approve')}
                </Button>
              )}

              {order.status === 'approved' && (
                <Button
                  className='w-full bg-purple-600 hover:bg-purple-700 text-white'
                  onClick={() =>
                    handleAction(
                      sendToSupplier as Parameters<typeof handleAction>[0],
                      t('orders.action.send_to_supplier'),
                      t('admin.common.error'),
                    )
                  }
                  disabled={sendToSupplier.isPending}
                >
                  {t('orders.action.send_to_supplier')}
                </Button>
              )}

              {order.status !== 'delivered' && order.status !== 'shipped' && order.status !== 'cancelled' && (
                <Button
                  variant='outline'
                  className='w-full text-red-600 border-red-200 hover:bg-red-50'
                  onClick={() =>
                    handleAction(
                      cancel as Parameters<typeof handleAction>[0],
                      t('orders.action.cancel'),
                      t('admin.common.error'),
                    )
                  }
                  disabled={cancel.isPending}
                >
                  {t('orders.action.cancel')}
                </Button>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className='lg:col-span-2 space-y-4'>
            {/* Items list */}
            <div className='bg-white rounded-xl border border-border p-4 space-y-4'>
              <h3 className='font-medium text-charcoal'>{t('orders.items')}</h3>
              {order.items.length === 0 ? (
                <p className='text-warm-gray text-sm'>{dir === 'rtl' ? 'אין פריטים' : 'No items'}</p>
              ) : (
                order.items.map((item) => (
                  <div key={item.id} className='border border-border rounded-lg p-3 space-y-2'>
                    <div className={`flex items-start justify-between gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                      <div>
                        <p className='font-medium text-charcoal text-sm'>{item.product.name}</p>
                        <span className='inline-block mt-0.5 bg-zinc-100 text-zinc-600 text-xs px-2 py-0.5 rounded-full'>
                          {item.product.type}
                        </span>
                      </div>
                      <div className={`text-sm text-warm-gray ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                        <p>{t('orders.quantity')}: {item.quantity}</p>
                        {item.unitCostPrice > 0 && (
                          <p>{t('orders.price.unit')}: ₪{item.unitCostPrice}</p>
                        )}
                      </div>
                    </div>

                    {item.selectedImageIds.length > 0 && (
                      <p className='text-xs text-warm-gray'>
                        {item.selectedImageIds.length} {t('orders.photos.selected')}
                      </p>
                    )}

                    {Object.keys(item.imageNotes).length > 0 && (
                      <div className='text-xs text-warm-gray'>
                        <span className='font-medium'>{dir === 'rtl' ? 'הערות תמונות:' : 'Image notes:'}</span>{' '}
                        {Object.values(item.imageNotes).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Notes */}
            {(order.photographerNote || order.clientNote || order.supplierNote) && (
              <div className='bg-white rounded-xl border border-border p-4 space-y-3'>
                <h3 className='font-medium text-charcoal'>{dir === 'rtl' ? 'הערות' : 'Notes'}</h3>
                {order.photographerNote && (
                  <div>
                    <p className='text-xs font-medium text-warm-gray mb-1'>{t('orders.note.photographer')}</p>
                    <p className='text-sm text-charcoal bg-ivory rounded-lg px-3 py-2'>{order.photographerNote}</p>
                  </div>
                )}
                {order.clientNote && (
                  <div>
                    <p className='text-xs font-medium text-warm-gray mb-1'>{t('orders.note.client')}</p>
                    <p className='text-sm text-charcoal bg-ivory rounded-lg px-3 py-2'>{order.clientNote}</p>
                  </div>
                )}
                {order.supplierNote && (
                  <div>
                    <p className='text-xs font-medium text-warm-gray mb-1'>{t('orders.note.supplier')}</p>
                    <p className='text-sm text-charcoal bg-ivory rounded-lg px-3 py-2'>{order.supplierNote}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tracking info */}
            {(order.trackingNumber || order.trackingCarrier) && (
              <div className='bg-white rounded-xl border border-border p-4 space-y-2'>
                <h3 className='font-medium text-charcoal'>{dir === 'rtl' ? 'מעקב משלוח' : 'Shipping Tracking'}</h3>
                {order.trackingCarrier && (
                  <div className={`flex gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <span className='text-warm-gray text-sm'>{t('orders.tracking.carrier')}:</span>
                    <span className='text-sm text-charcoal'>{order.trackingCarrier}</span>
                  </div>
                )}
                {order.trackingNumber && (
                  <div className={`flex gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <span className='text-warm-gray text-sm'>{t('orders.tracking')}:</span>
                    <span className='text-sm font-mono text-charcoal'>{order.trackingNumber}</span>
                  </div>
                )}
                {order.shippedAt && (
                  <div className={`flex gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <span className='text-warm-gray text-sm'>{dir === 'rtl' ? 'תאריך משלוח:' : 'Shipped at:'}</span>
                    <span className='text-sm text-charcoal'>{new Date(order.shippedAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
