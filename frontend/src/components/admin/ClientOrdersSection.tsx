import { useMemo, useState } from 'react';
import { ShoppingBag, Mail, Check, Plus, Package, Truck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { sendProductOrderLinksEmail } from '@/services/productOrderService';
import { useProductOrders, useOrders } from '@/hooks/useQueries';
import { ProductOrderCard } from './ProductOrderCard';
import { CreateOrderModal } from '@/components/admin/CreateOrderModal';
import { OrderCard, OrderCardSkeleton } from './StoreOrderCard';
import type { ProductOrder } from '@/services/productOrderService';
import type { StoreOrder } from '@/lib/api';
import type { Gallery } from '@/types/gallery';

interface Props {
  clientId: string;
  clientName: string;
  galleries: Gallery[];
  clientEmail?: string;
}

type MergedEntry =
  | { kind: 'catalog'; createdAt: string; order: ProductOrder }
  | { kind: 'supplier'; createdAt: string; order: StoreOrder };

/**
 * Unified orders section for the client page. New orders are always supplier
 * orders (created from the photographer's favorite supplier products); legacy
 * catalog product orders remain visible as history.
 */
export const ClientOrdersSection = ({ clientId, clientName, galleries, clientEmail }: Props) => {
  const { t } = useI18n();

  const { data: productOrders = [], isLoading: poLoading, refetch } = useProductOrders(clientId);
  const { data: storeData, isLoading: soLoading } = useOrders({ clientId, limit: 20 });

  const [showCreateOrder, setShowCreateOrder] = useState(false);

  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const entries: MergedEntry[] = useMemo(() => {
    const storeOrders = storeData?.orders ?? [];
    const merged: MergedEntry[] = [
      ...productOrders.map((o): MergedEntry => ({ kind: 'catalog', createdAt: o.createdAt, order: o })),
      ...storeOrders.map((o): MergedEntry => ({ kind: 'supplier', createdAt: o.createdAt, order: o })),
    ];
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [productOrders, storeData]);

  const isLoading = poLoading || soLoading;
  const hasEnabledLinks = productOrders.some((o) => o.linkEnabled);

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setEmailSent(false);
    try {
      await sendProductOrderLinksEmail({ clientId, clientName, clientEmail: clientEmail! });
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch { /* ignore */ }
    finally { setSendingEmail(false); }
  };

  const kindBadge = (kind: MergedEntry['kind']) => (
    <span className='absolute -top-2 start-4 z-10 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-beige bg-ivory text-warm-gray'>
      {kind === 'catalog' ? <Package size={9} /> : <Truck size={9} />}
      {kind === 'catalog' ? t('orders.kind_catalog') : t('orders.kind_supplier')}
    </span>
  );

  return (
    <>
      <section className='bg-card rounded-2xl border border-beige flex flex-col max-h-[560px] shadow-[1px_1px_5px_rgba(0,0,0,0.4)] lg:col-span-1'>
        {/* Header — pinned */}
        <div className='flex items-center justify-between flex-wrap gap-2 px-6 py-4 shrink-0 border-b border-beige'>
          <h2 className='text-lg text-charcoal flex items-center gap-2'>
            <ShoppingBag size={18} className='text-blush' />
            {t('orders.title')}
            {entries.length > 0 && (
              <span className='text-[11px] bg-blush/20 text-blush px-2 py-0.5 rounded-full font-medium'>
                {entries.length}
              </span>
            )}
          </h2>
          <div className='flex items-center gap-3'>
            {clientEmail && hasEnabledLinks && (
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className='flex items-center gap-1 text-sm text-warm-gray hover:text-charcoal transition-colors disabled:opacity-50 cursor-pointer'
              >
                {emailSent ? <Check size={14} className='text-green-500' /> : <Mail size={14} />}
                {emailSent
                  ? t('admin.products.email_sent')
                  : sendingEmail
                  ? t('admin.common.saving')
                  : t('admin.products.send_links_email')}
              </button>
            )}

            <button
              onClick={() => setShowCreateOrder(true)}
              className='text-sm text-blush hover:text-charcoal transition-colors flex items-center gap-1 cursor-pointer'
            >
              <Plus size={15} />
              {t('orders.new')}
            </button>
          </div>
        </div>

        {/* Merged orders list — scrollable */}
        <div className='flex-1 overflow-y-auto px-6 py-4 space-y-5'>
          {isLoading ? (
            <>
              <OrderCardSkeleton />
              <OrderCardSkeleton />
            </>
          ) : entries.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-8 text-center gap-2'>
              <ShoppingBag size={28} className='text-beige' />
              <p className='text-sm text-warm-gray'>{t('admin.products.no_orders')}</p>
              <button
                onClick={() => setShowCreateOrder(true)}
                className='text-xs text-blush hover:text-blush/80 transition-colors cursor-pointer'
              >
                + {t('orders.new')}
              </button>
            </div>
          ) : (
            entries.map((entry) => (
              <div key={`${entry.kind}-${entry.kind === 'catalog' ? entry.order._id : entry.order.id}`} className='relative pt-1'>
                {kindBadge(entry.kind)}
                {entry.kind === 'catalog' ? (
                  <ProductOrderCard
                    order={entry.order}
                    clientId={clientId}
                    galleries={galleries}
                    refetch={refetch}
                  />
                ) : (
                  <OrderCard order={entry.order} />
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <CreateOrderModal
        isOpen={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        defaultClientId={clientId}
      />
    </>
  );
};
