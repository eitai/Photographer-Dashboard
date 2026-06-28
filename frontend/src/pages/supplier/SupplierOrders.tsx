import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useSupplierOrders } from '@/hooks/useQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, ShoppingCart, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getSupplierOrdersReport, type StoreOrder } from '@/lib/api';
import { downloadCsv } from '@/lib/exportCsv';

interface StatusStyle {
  bg: string;
  text: string;
  dot: string;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  draft:             { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  pending_selection: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  selection_submitted: { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  approved:          { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  sent_to_supplier:  { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  in_production:     { bg: '#ffedd5', text: '#9a3412', dot: '#f97316' },
  ready_to_ship:     { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' },
  shipped:           { bg: '#e0f2fe', text: '#0c4a6e', dot: '#0ea5e9' },
  delivered:         { bg: '#dcfce7', text: '#14532d', dot: '#22c55e' },
  cancelled:         { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
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

export const SupplierOrders = () => {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const filters = {
    status: statusFilter === 'all' ? undefined : statusFilter,
    from: from || undefined,
    to: to || undefined,
  };

  const { data, isLoading } = useSupplierOrders({ ...filters, page, limit: 20 });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  // Summary across the full filtered set (cost basis = what the supplier is paid)
  const { data: report } = useQuery({
    queryKey: ['supplier', 'orders', 'report', filters],
    queryFn: () => getSupplierOrdersReport(filters),
  });

  const fmtMoney = (n: number) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

  const handleExport = async () => {
    setExporting(true);
    try {
      const rep = await getSupplierOrdersReport(filters);
      const he = dir === 'rtl';
      const headers = he
        ? ['מספר', 'צלם', 'סטודיו', 'פריטים', 'סטטוס', 'לתשלום', 'תאריך']
        : ['#', 'Photographer', 'Studio', 'Items', 'Status', 'To pay', 'Date'];
      const rows = rep.rows.map((o, i) => [
        i + 1,
        o.photographerName ?? '—',
        o.studioName ?? '—',
        o.itemsCount ?? 0,
        o.status,
        o.costTotal,
        new Date(o.createdAt).toLocaleDateString(he ? 'he-IL' : 'en-GB'),
      ]);
      const summaryRow = [he ? 'סה״כ' : 'Total', '', '', '', '', rep.summary.totalToPay, `${rep.summary.count}`];
      downloadCsv('supplier-orders', headers, rows, summaryRow);
      if (rep.capped) toast.warning(t('supplier.orders.report_capped'));
    } catch {
      toast.error(t('supplier.orders.export_failed'));
    } finally {
      setExporting(false);
    }
  };

  const statusOptions = [
    { value: 'all',              label: t('supplier.orders.all_statuses') },
    { value: 'sent_to_supplier', label: t('orders.status.sent_to_supplier') },
    { value: 'in_production',    label: t('orders.status.in_production') },
    { value: 'ready_to_ship',    label: t('orders.status.ready_to_ship') },
    { value: 'shipped',          label: t('orders.status.shipped') },
    { value: 'delivered',        label: t('orders.status.delivered') },
  ];

  return (
    <div className='p-6 md:p-8'>
      {/* Page header */}
      <div className='flex items-center justify-between mb-8'>
        <div className='flex items-center gap-3'>
          <h1 className='text-2xl font-semibold text-zinc-900 tracking-tight'>
            {t('supplier.orders.title')}
          </h1>
          {!isLoading && total > 0 && (
            <span className='inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-primary text-primary-foreground'>
              {total}
            </span>
          )}
        </div>

        {/* Filters + export */}
        <div className='flex items-center gap-2 flex-wrap'>
          <input type='date' value={from} max={to || undefined}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className='h-9 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-700' />
          <span className='text-zinc-400 text-sm'>–</span>
          <input type='date' value={to} min={from || undefined}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className='h-9 rounded-xl border border-zinc-200 bg-white px-2 text-sm text-zinc-700' />
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
          >
            <SelectTrigger className='w-44 bg-white border-zinc-200 text-sm rounded-xl h-9'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type='button'
            onClick={handleExport}
            disabled={exporting}
            className='inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50'
          >
            <Download size={15} />
            {exporting ? t('supplier.orders.exporting') : t('supplier.orders.export_csv')}
          </button>
        </div>
      </div>

      {/* Summary strip — full filtered set, cost basis (what you are paid) */}
      {report && (
        <div className={`flex gap-6 text-sm rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-2.5 mb-5 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <span className='text-zinc-500'>{dir === 'rtl' ? 'הזמנות' : 'Orders'}: <span className='text-zinc-900 font-medium'>{report.summary.count}</span></span>
          <span className='text-zinc-500'>{dir === 'rtl' ? 'סה״כ לתשלום' : 'Total to pay'}: <span className='text-zinc-900 font-medium'>{fmtMoney(report.summary.totalToPay)}</span></span>
        </div>
      )}

      {/* Table */}
      <div className='bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm'>
        <Table>
          <TableHeader>
            <TableRow className='border-b border-zinc-100'>
              <TableHead className='w-10 text-xs font-semibold text-zinc-500 uppercase tracking-wider ps-5'>
                #
              </TableHead>
              <TableHead className='text-xs font-semibold text-zinc-500 uppercase tracking-wider'>
                {t('orders.client')}
              </TableHead>
              <TableHead className='text-xs font-semibold text-zinc-500 uppercase tracking-wider'>
                {t('orders.items')}
              </TableHead>
              <TableHead className='text-xs font-semibold text-zinc-500 uppercase tracking-wider'>
                {t('admin.common.status')}
              </TableHead>
              <TableHead className='text-xs font-semibold text-zinc-500 uppercase tracking-wider'>
                {t('orders.total')}
              </TableHead>
              <TableHead className='text-xs font-semibold text-zinc-500 uppercase tracking-wider'>
                {dir === 'rtl' ? 'נשלח ב' : 'Sent At'}
              </TableHead>
              <TableHead className='w-16' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className='border-b border-zinc-50'>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j} className={j === 0 ? 'ps-5' : ''}>
                      <Skeleton className='h-4 w-full rounded-md' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className='flex flex-col items-center justify-center py-20 text-center'>
                    <div className='w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4'>
                      <ShoppingCart size={24} className='text-zinc-400' />
                    </div>
                    <p className='text-sm font-semibold text-zinc-600 mb-1'>
                      {t('supplier.orders.empty')}
                    </p>
                    <p className='text-xs text-zinc-400'>
                      {dir === 'rtl'
                        ? 'הזמנות שנשלחו אליך יופיעו כאן'
                        : 'Orders sent to you will appear here'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order: StoreOrder, idx: number) => (
                <TableRow
                  key={order.id}
                  className='border-b border-zinc-50 transition-colors duration-100 hover:bg-zinc-50/60 cursor-pointer'
                  onClick={() => navigate(`/supplier/orders/${order.id}`)}
                >
                  <TableCell className='text-xs text-zinc-400 font-mono ps-5'>
                    {(page - 1) * 20 + idx + 1}
                  </TableCell>
                  <TableCell className='font-medium text-zinc-900 text-sm'>
                    {order.client?.name ?? order.shippingAddress?.name ?? '—'}
                  </TableCell>
                  <TableCell className='text-sm text-zinc-500'>
                    {(order.itemsCount ?? order.items?.length ?? 0)}{' '}
                    <span className='text-zinc-400'>{t('orders.items')}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={order.status}
                      label={t(`orders.status.${order.status}`)}
                    />
                  </TableCell>
                  <TableCell className='text-sm font-medium text-zinc-900'>
                    {(order.costTotal ?? order.totalAmount) != null ? `₪${(order.costTotal ?? order.totalAmount)!.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className='text-xs text-zinc-400'>
                    {order.sentToSupplierAt
                      ? new Date(order.sentToSupplierAt).toLocaleDateString(
                          dir === 'rtl' ? 'he-IL' : 'en-GB',
                        )
                      : '—'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <button
                      className='p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors duration-150 cursor-pointer'
                      onClick={() => navigate(`/supplier/orders/${order.id}`)}
                      aria-label={dir === 'rtl' ? 'צפה בהזמנה' : 'View order'}
                    >
                      <Eye size={15} />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-end gap-2 mt-5'>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer'
          >
            {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {dir === 'rtl' ? 'הקודם' : 'Previous'}
          </button>
          <span className='text-sm text-zinc-500 px-1 tabular-nums'>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className='flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer'
          >
            {dir === 'rtl' ? 'הבא' : 'Next'}
            {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      )}
    </div>
  );
};
