import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useOrders } from '@/hooks/useQueries';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Download, Store } from 'lucide-react';
import { toast } from 'sonner';
import { getOrdersReport, type StoreOrder } from '@/lib/api';
import { downloadCsv } from '@/lib/exportCsv';

type OrderStatus = StoreOrder['status'] | 'all' | 'open';
type OrderFlow = 'all' | 'photographer' | 'client';

const STATUS_COLORS: Record<StoreOrder['status'], string> = {
  draft: 'bg-ivory text-warm-gray border border-beige',
  pending_selection: 'bg-amber-50 text-amber-700',
  selection_submitted: 'bg-blush/15 text-charcoal',
  approved: 'bg-green-50 text-green-700',
  sent_to_supplier: 'bg-ivory text-charcoal border border-beige',
  in_production: 'bg-amber-50 text-amber-700',
  ready_to_ship: 'bg-indigo-50 text-indigo-700',
  shipped: 'bg-sky-50 text-sky-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
};

export const AdminOrders = () => {
  const { t, lang, dir } = useI18n();
  const theme = useAuthStore((s) => s.theme);
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('open');
  const [flowFilter, setFlowFilter] = useState<OrderFlow>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const filters = {
    status: statusFilter === 'all' ? undefined : statusFilter,
    flow: flowFilter === 'all' ? undefined : flowFilter,
    from: from || undefined,
    to: to || undefined,
  };

  const { data, isLoading } = useOrders({ ...filters, page, limit: 20 });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  // Summary across the FULL filtered set (not just the current page).
  const { data: report } = useQuery({
    queryKey: ['orders', 'report', filters],
    queryFn: () => getOrdersReport(filters),
  });

  const fmtMoney = (n: number) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

  const handleExport = async () => {
    setExporting(true);
    try {
      const rep = await getOrdersReport(filters);
      const headers = lang === 'he'
        ? ['מספר', 'לקוח', 'גלריה', 'פריטים', 'סטטוס', 'זרימה', 'סכום', 'תאריך']
        : ['#', 'Client', 'Gallery', 'Items', 'Status', 'Flow', 'Total', 'Date'];
      const rows = rep.rows.map((o, i) => [
        i + 1,
        o.clientName ?? (lang === 'he' ? 'הזמנה ישירה' : 'Direct order'),
        o.galleryName ?? '—',
        o.itemsCount ?? 0,
        o.status,
        o.flow,
        o.totalAmount != null ? o.totalAmount : '',
        new Date(o.createdAt).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB'),
      ]);
      const summaryRow = [
        lang === 'he' ? 'סה״כ' : 'Total', '', '', '', '', '',
        rep.summary.totalAmount, `${rep.summary.count}`,
      ];
      downloadCsv('orders', headers, rows, summaryRow);
      if (rep.capped) toast.warning(lang === 'he' ? 'הדוח נחתך ל-5000 שורות' : 'Report capped at 5000 rows');
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setExporting(false);
    }
  };

  const statusOptions: { value: OrderStatus; label: string }[] = [
    { value: 'open', label: dir === 'rtl' ? 'פתוחות' : 'Open Orders' },
    { value: 'all', label: dir === 'rtl' ? 'הכל' : 'All' },
    { value: 'draft', label: t('orders.status.draft') },
    { value: 'pending_selection', label: t('orders.status.pending_selection') },
    { value: 'selection_submitted', label: t('orders.status.selection_submitted') },
    { value: 'approved', label: t('orders.status.approved') },
    { value: 'sent_to_supplier', label: t('orders.status.sent_to_supplier') },
    { value: 'in_production', label: t('orders.status.in_production') },
    { value: 'ready_to_ship', label: t('orders.status.ready_to_ship') },
    { value: 'shipped', label: t('orders.status.shipped') },
    { value: 'delivered', label: t('orders.status.delivered') },
    { value: 'cancelled', label: t('orders.status.cancelled') },
  ];

  const flowOptions: { value: OrderFlow; label: string }[] = [
    { value: 'all', label: dir === 'rtl' ? 'הכל' : 'All' },
    { value: 'photographer', label: t('orders.flow.photographer') },
    { value: 'client', label: t('orders.flow.client') },
  ];

  return (
    <AdminLayout>
      <div className='p-6 space-y-6'>
        {/* Header */}
        <div className={`flex items-center justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <h1 className='font-serif text-2xl text-charcoal'>{t('orders.title')}</h1>
          <div className={`flex gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <Button
              variant='outline'
              size='sm'
              className='gap-2'
              onClick={handleExport}
              disabled={exporting}
            >
              <Download size={15} />
              {exporting ? t('admin.common.saving') : t('reports.export_csv')}
            </Button>
            <Button
              onClick={() => navigate('/admin/store')}
              variant='outline'
              className='gap-2'
            >
              <Store size={16} />
              {t('admin.nav.store')}
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className={`flex gap-3 flex-wrap ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v as OrderStatus); setPage(1); }}
            dir={dir}
          >
            <SelectTrigger className='w-48'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent data-theme={theme} dir={dir}>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={flowFilter}
            onValueChange={(v) => { setFlowFilter(v as OrderFlow); setPage(1); }}
            dir={dir}
          >
            <SelectTrigger className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent data-theme={theme} dir={dir}>
              {flowOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className='flex items-center gap-2'>
            <label className='text-xs text-warm-gray'>{t('reports.from')}</label>
            <input type='date' value={from} max={to || undefined}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className='h-9 rounded-md border border-border bg-white px-2 text-sm text-charcoal' />
            <label className='text-xs text-warm-gray'>{t('reports.to')}</label>
            <input type='date' value={to} min={from || undefined}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className='h-9 rounded-md border border-border bg-white px-2 text-sm text-charcoal' />
            {(from || to) && (
              <button type='button' onClick={() => { setFrom(''); setTo(''); setPage(1); }}
                className='text-xs text-warm-gray underline'>{t('reports.clear')}</button>
            )}
          </div>
        </div>

        {/* Summary strip — reflects the full filtered set, not just this page */}
        {report && (
          <div className={`flex gap-6 text-sm rounded-xl border border-border bg-ivory/50 px-4 py-2.5 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <span className='text-warm-gray'>{t('reports.count')}: <span className='text-charcoal font-medium'>{report.summary.count}</span></span>
            <span className='text-warm-gray'>{t('reports.total')}: <span className='text-charcoal font-medium'>{fmtMoney(report.summary.totalAmount)}</span></span>
          </div>
        )}

        {/* Table */}
        <div className='rounded-xl border border-border bg-white overflow-hidden'>
          <Table>
            <TableHeader>
              <TableRow className='bg-ivory/60'>
                <TableHead className='w-10'>#</TableHead>
                <TableHead>{t('orders.client')}</TableHead>
                <TableHead>{t('orders.gallery')}</TableHead>
                <TableHead>{t('orders.items')}</TableHead>
                <TableHead>{t('admin.common.status')}</TableHead>
                <TableHead>{t('orders.total')}</TableHead>
                <TableHead>{t('orders.created')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className='h-4 w-full' /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className='text-center py-16 text-warm-gray'>
                    {t('orders.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order, idx) => (
                  <TableRow key={order.id} className='hover:bg-ivory/40 transition-colors'>
                    <TableCell className='text-warm-gray text-xs'>{(page - 1) * 20 + idx + 1}</TableCell>
                    <TableCell className='font-medium text-charcoal'>
                      {order.client?.name ?? (
                        <span className='inline-block text-xs px-2 py-0.5 rounded-full bg-ivory border border-beige text-warm-gray'>
                          {t('orders.direct_badge')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className='text-warm-gray text-sm'>{order.gallery?.name ?? '—'}</TableCell>
                    <TableCell className='text-warm-gray text-sm'>
                      {(order.itemsCount ?? order.items?.length ?? 0)} {t('orders.items')}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {t(`orders.status.${order.status}`)}
                      </span>
                    </TableCell>
                    <TableCell className='text-sm'>
                      {order.totalAmount != null ? `₪${order.totalAmount.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell className='text-warm-gray text-xs'>
                      {new Date(order.createdAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}
                    </TableCell>
                    <TableCell>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='gap-1 text-xs'
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
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
            <Button
              size='sm'
              variant='outline'
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {dir === 'rtl' ? 'הקודם' : 'Previous'}
            </Button>
            <span className='text-sm text-warm-gray'>{page} / {totalPages}</span>
            <Button
              size='sm'
              variant='outline'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {dir === 'rtl' ? 'הבא' : 'Next'}
            </Button>
          </div>
        )}
      </div>

    </AdminLayout>
  );
};
