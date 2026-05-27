import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { useSupplierOrders } from '@/hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye } from 'lucide-react';
import type { StoreOrder } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
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

export const SupplierOrders = () => {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSupplierOrders({
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    limit: 20,
  });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const statusOptions = [
    { value: 'all', label: dir === 'rtl' ? 'הכל' : 'All' },
    { value: 'sent_to_supplier', label: t('orders.status.sent_to_supplier') },
    { value: 'in_production', label: t('orders.status.in_production') },
    { value: 'shipped', label: t('orders.status.shipped') },
    { value: 'delivered', label: t('orders.status.delivered') },
  ];

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div className={`flex items-center justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
        <h1 className='font-serif text-2xl text-charcoal'>{t('supplier.orders.title')}</h1>
      </div>

      {/* Filter */}
      <div className={`flex gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
        >
          <SelectTrigger className='w-48'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className='rounded-xl border border-border bg-white overflow-hidden'>
        <Table>
          <TableHeader>
            <TableRow className='bg-ivory/60'>
              <TableHead className='w-10'>#</TableHead>
              <TableHead>{t('orders.client')}</TableHead>
              <TableHead>{t('orders.items')}</TableHead>
              <TableHead>{t('admin.common.status')}</TableHead>
              <TableHead>{t('orders.total')}</TableHead>
              <TableHead>{dir === 'rtl' ? 'נשלח ב' : 'Sent At'}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className='h-4 w-full' /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='text-center py-16 text-warm-gray'>
                  {t('supplier.orders.empty')}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order: StoreOrder, idx: number) => (
                <TableRow key={order.id} className='hover:bg-ivory/40 transition-colors'>
                  <TableCell className='text-warm-gray text-xs'>{(page - 1) * 20 + idx + 1}</TableCell>
                  <TableCell className='font-medium text-charcoal'>{order.client.name}</TableCell>
                  <TableCell className='text-warm-gray text-sm'>
                    {(order.itemsCount ?? order.items?.length ?? 0)} {t('orders.items')}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? ''}`}>
                      {t(`orders.status.${order.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className='text-sm'>
                    {order.totalAmount != null ? `₪${order.totalAmount.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className='text-warm-gray text-xs'>
                    {order.sentToSupplierAt
                      ? new Date(order.sentToSupplierAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size='sm'
                      variant='ghost'
                      className='gap-1 text-xs'
                      onClick={() => navigate(`/supplier/orders/${order.id}`)}
                    >
                      <Eye size={14} />
                      {dir === 'rtl' ? 'צפה' : 'View'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`flex items-center gap-2 ${dir === 'rtl' ? 'justify-end flex-row-reverse' : 'justify-end'}`}>
          <Button size='sm' variant='outline' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {dir === 'rtl' ? 'הקודם' : 'Previous'}
          </Button>
          <span className='text-sm text-warm-gray'>{page} / {totalPages}</span>
          <Button size='sm' variant='outline' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {dir === 'rtl' ? 'הבא' : 'Next'}
          </Button>
        </div>
      )}
    </div>
  );
};
