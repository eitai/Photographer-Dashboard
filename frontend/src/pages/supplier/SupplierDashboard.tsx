import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { useSupplierOrders } from '@/hooks/useQueries';
import { useSupplierAuth } from '@/hooks/useSupplierAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight } from 'lucide-react';
import type { StoreOrder } from '@/lib/api';

// ─── Status badge (mirrors SupplierOrders.tsx) ────────────────────────────────

interface StatusStyle {
  bg: string;
  text: string;
  dot: string;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  draft:               { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  pending_selection:   { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  selection_submitted: { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  approved:            { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  sent_to_supplier:    { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  in_production:       { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
  ready_to_ship:       { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' },
  shipped:             { bg: '#e0f2fe', text: '#0c4a6e', dot: '#0ea5e9' },
  delivered:           { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  cancelled:           { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

const StatusBadge = ({ status, label }: { status: string; label: string }) => {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['draft'];
  return (
    <span
      className='inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium'
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      <span
        className='w-1.5 h-1.5 rounded-full flex-shrink-0'
        style={{ backgroundColor: style.dot }}
      />
      {label}
    </span>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  count: number | undefined;
  isLoading: boolean;
  inverted?: boolean;
  muted?: boolean;
}

const StatCard = ({ label, count, isLoading, inverted = false, muted = false }: StatCardProps) => (
  <div
    className={`rounded-2xl p-5 flex flex-col gap-2 ${
      inverted
        ? 'bg-foreground text-background'
        : 'bg-card border border-border'
    }`}
  >
    <p className={`text-xs uppercase tracking-widest ${inverted ? 'opacity-60' : muted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
      {label}
    </p>
    {isLoading ? (
      <Skeleton className='h-8 w-12 rounded-md' />
    ) : (
      <p className={`text-3xl font-semibold tabular-nums ${muted && !inverted ? 'text-muted-foreground' : ''}`}>
        {count ?? 0}
      </p>
    )}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const SupplierDashboard = () => {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const { supplier } = useSupplierAuth();

  // Stat counts — use limit:1 so the backend only fetches the minimum
  const newOrdersQuery       = useSupplierOrders({ status: 'sent_to_supplier', limit: 1 });
  const inProductionQuery    = useSupplierOrders({ status: 'in_production',    limit: 1 });
  const readyToShipQuery     = useSupplierOrders({ status: 'ready_to_ship',    limit: 1 });
  const shippedQuery         = useSupplierOrders({ status: 'shipped',          limit: 1 });
  const deliveredQuery       = useSupplierOrders({ status: 'delivered',        limit: 1 });

  // Recent orders table
  const recentQuery = useSupplierOrders({ limit: 8 });
  const recentOrders: StoreOrder[] = recentQuery.data?.orders ?? [];

  const stats = [
    {
      label: t('supplier.dashboard.new_orders'),
      count: newOrdersQuery.data?.total,
      isLoading: newOrdersQuery.isLoading,
      inverted: true,
    },
    {
      label: t('supplier.dashboard.in_production'),
      count: inProductionQuery.data?.total,
      isLoading: inProductionQuery.isLoading,
    },
    {
      label: t('supplier.dashboard.ready_to_ship'),
      count: readyToShipQuery.data?.total,
      isLoading: readyToShipQuery.isLoading,
    },
    {
      label: t('supplier.dashboard.shipped'),
      count: shippedQuery.data?.total,
      isLoading: shippedQuery.isLoading,
    },
    {
      label: t('supplier.dashboard.delivered'),
      count: deliveredQuery.data?.total,
      isLoading: deliveredQuery.isLoading,
      muted: true,
    },
  ];

  return (
    <div className='p-6 md:p-8 max-w-5xl'>
      {/* Greeting */}
      <div className='mb-8'>
        <p className='text-xs uppercase tracking-widest text-muted-foreground mb-1'>
          {t('supplier.dashboard.greeting')}
        </p>
        <h1 className='text-2xl font-semibold text-foreground tracking-tight'>
          {supplier?.name ?? ''}
        </h1>
      </div>

      {/* Stat cards */}
      <div className='grid grid-cols-2 lg:grid-cols-5 gap-3 mb-10'>
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            count={s.count}
            isLoading={s.isLoading}
            inverted={s.inverted}
            muted={s.muted}
          />
        ))}
      </div>

      {/* Recent orders */}
      <div>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-sm font-semibold uppercase tracking-widest text-foreground'>
            {t('supplier.dashboard.recent_orders')}
          </h2>
          <button
            onClick={() => navigate('/supplier/orders')}
            className='flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer'
          >
            {t('supplier.dashboard.see_all')}
            <ArrowRight size={13} className={dir === 'rtl' ? 'rotate-180' : ''} />
          </button>
        </div>

        <div className='bg-card rounded-2xl border border-border overflow-hidden'>
          <Table>
            <TableHeader>
              <TableRow className='border-b border-border'>
                <TableHead className='text-xs font-semibold text-muted-foreground uppercase tracking-wider ps-5'>
                  {t('orders.client')}
                </TableHead>
                <TableHead className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                  {t('orders.items')}
                </TableHead>
                <TableHead className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                  {t('admin.common.status')}
                </TableHead>
                <TableHead className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                  {dir === 'rtl' ? 'נשלח ב' : 'Sent At'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className='border-b border-border'>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j} className={j === 0 ? 'ps-5' : ''}>
                        <Skeleton className='h-4 w-full rounded-md' />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className='flex items-center justify-center py-14 text-sm text-muted-foreground'>
                      {t('supplier.dashboard.no_recent')}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                recentOrders.map((order: StoreOrder) => (
                  <TableRow
                    key={order.id}
                    className='border-b border-border transition-colors duration-100 hover:bg-muted/40 cursor-pointer'
                    onClick={() => navigate(`/supplier/orders/${order.id}`)}
                  >
                    <TableCell className='font-medium text-foreground text-sm ps-5'>
                      {order.client?.name ?? '—'}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {order.itemsCount ?? order.items?.length ?? 0}{' '}
                      <span className='text-muted-foreground/60'>{t('orders.items')}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={order.status}
                        label={t(`orders.status.${order.status}`)}
                      />
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {order.sentToSupplierAt
                        ? new Date(order.sentToSupplierAt).toLocaleDateString(
                            dir === 'rtl' ? 'he-IL' : 'en-GB',
                          )
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
