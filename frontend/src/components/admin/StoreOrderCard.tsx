import { useState } from 'react';
import { Trash2, CheckCircle2, Clock, Truck, Package, Send, Bell } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSendOrderToClient,
  useApproveOrder,
  useSendOrderToSupplier,
  useNotifyOrderClient,
  useDeleteOrder,
  useCancelOrder,
} from '@/hooks/useQueries';
import type { StoreOrder } from '@/lib/api';

// ---------------------------------------------------------------------------
// Pipeline config & status maps
// ---------------------------------------------------------------------------

type OrderStatus = StoreOrder['status'];

const PIPELINE_STAGES: { key: OrderStatus; labelKey: string }[] = [
  { key: 'draft',               labelKey: 'orders.status.draft' },
  { key: 'pending_selection',   labelKey: 'orders.status.pending_selection' },
  { key: 'selection_submitted', labelKey: 'orders.status.selection_submitted' },
  { key: 'approved',            labelKey: 'orders.status.approved' },
  { key: 'sent_to_supplier',    labelKey: 'orders.status.sent_to_supplier' },
  { key: 'in_production',       labelKey: 'orders.status.in_production' },
  { key: 'ready_to_ship',       labelKey: 'orders.status.ready_to_ship' },
  { key: 'shipped',             labelKey: 'orders.status.shipped' },
  { key: 'delivered',           labelKey: 'orders.status.delivered' },
];

const STATUS_ORDER: Record<OrderStatus, number> = {
  draft: 0, pending_selection: 1, selection_submitted: 2, approved: 3,
  sent_to_supplier: 4, in_production: 5, ready_to_ship: 6, shipped: 7, delivered: 8, cancelled: -1,
};

const STATUS_BADGE_STYLES: Record<OrderStatus, string> = {
  draft:               'bg-muted text-muted-foreground border border-border',
  pending_selection:   'bg-amber-50 text-amber-700 border border-amber-200',
  selection_submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved:            'bg-violet-50 text-violet-700 border border-violet-200',
  sent_to_supplier:    'bg-indigo-50 text-indigo-700 border border-indigo-200',
  in_production:       'bg-orange-50 text-orange-700 border border-orange-200',
  ready_to_ship:       'bg-indigo-50 text-indigo-700 border border-indigo-200',
  shipped:             'bg-sky-50 text-sky-700 border border-sky-200',
  delivered:           'bg-green-50 text-green-700 border border-green-200',
  cancelled:           'bg-red-50 text-red-700 border border-red-200',
};

const BORDER_BY_STATUS: Record<OrderStatus, string> = {
  draft:               'border-border hover:border-blush/40',
  pending_selection:   'border-amber-200 hover:border-amber-300',
  selection_submitted: 'border-blue-200 hover:border-blue-300',
  approved:            'border-violet-200 hover:border-violet-300',
  sent_to_supplier:    'border-indigo-200 hover:border-indigo-300',
  in_production:       'border-orange-200 hover:border-orange-300',
  ready_to_ship:       'border-indigo-200 hover:border-indigo-300',
  shipped:             'border-sky-200 hover:border-sky-300',
  delivered:           'border-green-200 hover:border-green-300',
  cancelled:           'border-red-100 hover:border-red-200',
};

// ---------------------------------------------------------------------------
// StatusTimeline
// ---------------------------------------------------------------------------

const StatusTimeline = ({ status }: { status: OrderStatus }) => {
  const currentIdx = STATUS_ORDER[status] ?? -1;

  if (status === 'cancelled') {
    return <p className='text-xs text-destructive italic mt-1'>Cancelled</p>;
  }

  return (
    <div className='flex items-center gap-0 mt-2 overflow-x-auto pb-1'>
      {PIPELINE_STAGES.map((stage, i) => {
        const stageIdx = STATUS_ORDER[stage.key];
        const isDone    = stageIdx < currentIdx;
        const isCurrent = stageIdx === currentIdx;
        return (
          <div key={stage.key} className='flex items-center'>
            {i > 0 && (
              <div className={`h-px w-3 shrink-0 ${isDone || isCurrent ? 'bg-blush' : 'bg-border'}`} />
            )}
            <div
              title={stage.key.replace(/_/g, ' ')}
              className={`w-2.5 h-2.5 shrink-0 rounded-full border transition-colors ${
                isCurrent
                  ? 'bg-blush border-blush ring-2 ring-blush/30'
                  : isDone
                  ? 'bg-blush border-blush'
                  : 'bg-background border-border'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// OrderCard
// ---------------------------------------------------------------------------

interface OrderCardProps {
  order: StoreOrder;
}

export const OrderCard = ({ order }: OrderCardProps) => {
  const { t, dir } = useI18n();
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const sendToClient   = useSendOrderToClient();
  const approve        = useApproveOrder();
  const sendToSupplier = useSendOrderToSupplier();
  const notifyClient   = useNotifyOrderClient();
  const deleteOrder    = useDeleteOrder();
  const cancelOrder    = useCancelOrder();

  const run = async (actionKey: string, fn: () => Promise<unknown>) => {
    setPendingAction(actionKey);
    try {
      await fn();
    } catch {
      toast({ title: t('admin.common.error'), variant: 'destructive' });
    } finally {
      setPendingAction(null);
    }
  };

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')
    : '—';

  const totalLabel = order.totalAmount != null ? `₪${order.totalAmount.toLocaleString()}` : '—';
  const borderClass = BORDER_BY_STATUS[order.status] ?? 'border-border';

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-sm ${borderClass}`}>
      {/* Header row */}
      <div className='px-4 py-3 flex items-start gap-3 flex-wrap'>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_BADGE_STYLES[order.status]}`}>
          {t(`orders.status.${order.status}` as Parameters<typeof t>[0])}
        </span>
        <div className='flex items-center gap-3 text-xs text-muted-foreground flex-wrap ms-auto'>
          {order.totalAmount != null && (
            <span>{t('orders.total')}: <span className='font-medium text-foreground'>{totalLabel}</span></span>
          )}
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Gallery + products */}
      <div className='px-4 pb-2'>
        {order.gallery && (
          <p className='text-[11px] text-muted-foreground mb-1'>
            {t('orders.gallery')}: <span className='text-foreground'>{order.gallery.name}</span>
          </p>
        )}
        {(order.items ?? []).length > 0 && (
          <p className='text-xs text-foreground'>
            {(order.items ?? []).map((item) => `${item.product?.name ?? '—'} ×${item.quantity}`).join(' · ')}
          </p>
        )}
        {(order.items ?? []).length === 0 && order.itemsCount != null && order.itemsCount > 0 && (
          <p className='text-xs text-muted-foreground'>{order.itemsCount} items</p>
        )}
      </div>

      {/* Timeline */}
      <div className='px-4 pb-3'>
        <StatusTimeline status={order.status} />
      </div>

      {/* Actions */}
      <div className='px-4 pb-3 flex items-center gap-2 flex-wrap border-t border-border pt-3'>
        {order.status === 'draft' && (
          <>
            <button
              onClick={() => run('send_to_client', () => sendToClient.mutateAsync(order.id))}
              disabled={pendingAction === 'send_to_client'}
              className='flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blush text-white hover:bg-blush/90 transition-colors disabled:opacity-60 cursor-pointer'
            >
              <Send size={11} />
              {pendingAction === 'send_to_client' ? t('admin.common.saving') : t('orders.action.send_to_client')}
            </button>
            <button
              onClick={() => run('delete', () => deleteOrder.mutateAsync(order.id))}
              disabled={pendingAction === 'delete'}
              className='flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60 cursor-pointer'
            >
              <Trash2 size={11} />
              {pendingAction === 'delete' ? t('admin.common.deleting') : t('orders.action.delete')}
            </button>
          </>
        )}

        {order.status === 'pending_selection' && (
          <p className='text-xs text-muted-foreground flex items-center gap-1'>
            <Clock size={12} /> Waiting for client…
          </p>
        )}

        {order.status === 'selection_submitted' && (
          <button
            onClick={() => run('approve', () => approve.mutateAsync(order.id))}
            disabled={pendingAction === 'approve'}
            className='flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-60 cursor-pointer'
          >
            <CheckCircle2 size={11} />
            {pendingAction === 'approve' ? t('admin.common.saving') : t('orders.action.approve')}
          </button>
        )}

        {order.status === 'approved' && (
          <button
            onClick={() => run('send_to_supplier', () => sendToSupplier.mutateAsync(order.id))}
            disabled={pendingAction === 'send_to_supplier'}
            className='flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-charcoal text-white hover:bg-charcoal/90 transition-colors disabled:opacity-60 cursor-pointer'
          >
            <Truck size={11} />
            {pendingAction === 'send_to_supplier' ? t('admin.common.saving') : t('orders.action.send_to_supplier')}
          </button>
        )}

        {order.status === 'sent_to_supplier' && (
          <p className='text-xs text-muted-foreground flex items-center gap-1'>
            <Package size={12} /> At supplier
          </p>
        )}

        {(order.status === 'in_production' || order.status === 'shipped') && (
          <button
            onClick={() => run('notify', () => notifyClient.mutateAsync(order.id))}
            disabled={pendingAction === 'notify'}
            className='flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-60 cursor-pointer'
          >
            <Bell size={11} />
            {pendingAction === 'notify' ? t('admin.common.saving') : t('orders.action.notify_client')}
          </button>
        )}

        {order.status === 'delivered' && (
          <p className='text-xs text-green-700 flex items-center gap-1 font-medium'>
            <CheckCircle2 size={12} /> {t('orders.status.delivered')}
          </p>
        )}

        {['pending_selection', 'selection_submitted', 'approved', 'sent_to_supplier', 'in_production', 'shipped'].includes(order.status) && (
          <button
            onClick={() => run('cancel', () => cancelOrder.mutateAsync(order.id))}
            disabled={pendingAction === 'cancel'}
            className='ms-auto text-[11px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-60 cursor-pointer'
          >
            {pendingAction === 'cancel' ? t('admin.common.saving') : t('orders.action.cancel')}
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// OrderCardSkeleton
// ---------------------------------------------------------------------------

export const OrderCardSkeleton = () => (
  <div className='rounded-xl border border-border p-4 space-y-3'>
    <div className='flex items-center gap-3'>
      <Skeleton className='h-5 w-20 rounded-full' />
      <Skeleton className='h-4 w-24 ms-auto' />
    </div>
    <Skeleton className='h-3 w-48' />
    <Skeleton className='h-3 w-32' />
    <div className='flex items-center gap-1 pt-1'>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className='w-2.5 h-2.5 rounded-full' />
      ))}
    </div>
    <div className='flex gap-2 border-t border-border pt-3'>
      <Skeleton className='h-7 w-24 rounded-lg' />
    </div>
  </div>
);
