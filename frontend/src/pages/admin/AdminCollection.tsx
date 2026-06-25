import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import {
  getBillingOverview, closeBillingCycle, markInvoicePaid, unblockPhotographer, backfillDocuments, chargePhotographers,
  getBillingReport,
} from '@/lib/api';
import { downloadCsv } from '@/lib/exportCsv';
import { Lock, Check, Download } from 'lucide-react';

const fmt = (n: number) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

export const AdminCollection = () => {
  const { t, dir } = useI18n();
  const qc = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [charging, setCharging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useQuery({ queryKey: ['billing', 'overview'], queryFn: getBillingOverview });

  // Financial report (revenue in period + current open debt + supplier balances)
  const { data: finReport } = useQuery({
    queryKey: ['billing', 'report', { from, to }],
    queryFn: () => getBillingReport({ from: from || undefined, to: to || undefined }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['billing', 'overview'] });

  const handleExportReport = async () => {
    setExporting(true);
    try {
      const rep = await getBillingReport({ from: from || undefined, to: to || undefined });
      // Photographers section
      const headers = ['סוג', 'שם', 'אימייל', 'שולם בתקופה', 'צבירה פתוחה', 'חשבוניות שלא שולמו', 'חוב כולל'];
      const photoRows = rep.photographers.map((p) => [
        'צלם', p.name, p.email, p.paidInPeriod, p.accrued, p.unpaidTotal, p.outstanding,
      ]);
      const supplierRows = rep.suppliers.map((s) => [
        'ספק', s.name, '', s.settledInPeriod, '', '', s.openBalance,
      ]);
      const totalRow = [
        'סה״כ', '', '', rep.totals.revenuePaid, rep.totals.openAccrual, rep.totals.revenuePending + rep.totals.revenueFailed, rep.totals.outstanding,
      ];
      downloadCsv('financial-report', headers, [...photoRows, ...supplierRows], totalRow);
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setExporting(false);
    }
  };

  // Photographers with any open debt (new accrual OR an unpaid invoice) are chargeable.
  const owes = (r: typeof rows[number]) => (r.outstanding ?? r.accrued) > 0;
  const billable = rows.filter(owes);
  const allSelected = billable.length > 0 && billable.every((r) => selected.has(r.adminId));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(billable.map((r) => r.adminId)));

  const charge = async (ids?: string[]) => {
    const msg = ids ? t('admin.collection.charge_confirm_selected') : t('admin.collection.charge_confirm_all');
    if (!window.confirm(msg)) return;
    setCharging(true);
    try {
      const r = await chargePhotographers(ids);
      toast.success(`✓${r.paid} · ✗${r.failed}`);
      setSelected(new Set());
      refresh();
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setCharging(false);
    }
  };

  const markPaid = useMutation({ mutationFn: markInvoicePaid, onSuccess: () => { toast.success(t('admin.collection.mark_paid')); refresh(); } });
  const unblock = useMutation({ mutationFn: unblockPhotographer, onSuccess: () => { toast.success(t('admin.collection.unblock')); refresh(); } });

  const handleClose = async () => {
    if (!window.confirm(t('admin.collection.close_confirm'))) return;
    setClosing(true);
    try {
      const r = await closeBillingCycle();
      toast.success(`${r.invoiced} · ✓${r.paid} · ✗${r.failed}`);
      refresh();
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setClosing(false);
    }
  };

  const handleBackfill = async () => {
    try {
      const r = await backfillDocuments();
      if (r.skipped) toast.error(r.reason || 'PayPlus disabled');
      else toast.success(`✓${r.issued} · ✗${r.failed}`);
    } catch {
      toast.error(t('admin.common.error'));
    }
  };

  const invStatus = (s: string) => {
    const map: Record<string, string> = {
      pending_payment: 'bg-amber-50 text-amber-700',
      paid: 'bg-green-50 text-green-700',
      failed: 'bg-red-50 text-red-600',
    };
    return map[s] ?? 'bg-ivory text-warm-gray';
  };

  return (
    <AdminLayout>
      <div className='p-6 space-y-6' dir={dir}>
        <div className={`flex items-center justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <h1 className='font-serif text-2xl text-charcoal'>{t('admin.collection.title')}</h1>
          <div className='flex gap-2 flex-wrap'>
            <Button variant='outline' onClick={handleBackfill}>
              {t('admin.docs.backfill')}
            </Button>
            <Button
              variant='outline'
              onClick={() => charge([...selected])}
              disabled={charging || selected.size === 0}
            >
              {t('admin.collection.charge_selected')} ({selected.size})
            </Button>
            <Button onClick={() => charge()} disabled={charging} className='bg-charcoal hover:bg-charcoal/90 text-white'>
              {charging ? t('admin.common.saving') : t('admin.collection.charge_all')}
            </Button>
            <Button onClick={handleClose} disabled={closing} variant='outline'>
              {closing ? t('admin.common.saving') : t('admin.collection.close_cycle')}
            </Button>
          </div>
        </div>

        {/* Financial report: date range + summary cards + export */}
        <div className='rounded-2xl border border-beige bg-card p-4 space-y-4'>
          <div className={`flex items-center gap-3 flex-wrap ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <span className='text-sm font-medium text-charcoal'>{t('reports.financial_title')}</span>
            <div className='flex items-center gap-2'>
              <label className='text-xs text-warm-gray'>{t('reports.from')}</label>
              <input type='date' value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
                className='h-9 rounded-md border border-border bg-white px-2 text-sm text-charcoal' />
              <label className='text-xs text-warm-gray'>{t('reports.to')}</label>
              <input type='date' value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
                className='h-9 rounded-md border border-border bg-white px-2 text-sm text-charcoal' />
              {(from || to) && (
                <button type='button' onClick={() => { setFrom(''); setTo(''); }} className='text-xs text-warm-gray underline'>{t('reports.clear')}</button>
              )}
            </div>
            <Button variant='outline' size='sm' className='gap-2 ms-auto' onClick={handleExportReport} disabled={exporting}>
              <Download size={15} />
              {exporting ? t('admin.common.saving') : t('reports.export_csv')}
            </Button>
          </div>
          {finReport && (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              {[
                { label: t('reports.revenue_paid'), value: finReport.totals.revenuePaid },
                { label: t('reports.outstanding'), value: finReport.totals.outstanding },
                { label: t('reports.open_accrual'), value: finReport.totals.openAccrual },
                { label: t('reports.supplier_owed'), value: finReport.totals.supplierOwed },
              ].map((c) => (
                <div key={c.label} className='rounded-xl border border-beige bg-ivory/50 px-4 py-3'>
                  <p className='text-xs text-warm-gray mb-1'>{c.label}</p>
                  <p className='text-lg font-semibold text-charcoal'>{fmt(c.value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <Skeleton className='h-64 rounded-xl' />
        ) : rows.length === 0 ? (
          <p className='text-warm-gray text-sm'>{t('admin.collection.none')}</p>
        ) : (
          <div className='bg-card rounded-2xl border border-beige overflow-hidden'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-10'>
                    <input
                      type='checkbox'
                      aria-label={t('admin.collection.select_all')}
                      className='accent-blush w-4 h-4 align-middle'
                      checked={allSelected}
                      disabled={billable.length === 0}
                      onChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>{t('admin.collection.photographer')}</TableHead>
                  <TableHead>{t('admin.collection.accrued')}</TableHead>
                  <TableHead>{t('admin.collection.last_invoice')}</TableHead>
                  <TableHead>{t('admin.collection.card')}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.adminId} className={r.billingBlocked ? 'bg-red-50/40' : ''}>
                    <TableCell>
                      <input
                        type='checkbox'
                        aria-label={r.name}
                        className='accent-blush w-4 h-4 align-middle disabled:opacity-30'
                        checked={selected.has(r.adminId)}
                        disabled={!owes(r)}
                        onChange={() => toggle(r.adminId)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        {r.billingBlocked && <Lock size={13} className='text-red-500' />}
                        <div>
                          <p className='text-sm font-medium text-charcoal'>{r.name}</p>
                          <p className='text-xs text-warm-gray'>{r.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-sm font-medium text-charcoal'>{fmt(r.outstanding ?? r.accrued)}</TableCell>
                    <TableCell>
                      {r.latestInvoice ? (
                        <span className='flex items-center gap-2'>
                          <span className='text-sm text-charcoal'>{fmt(r.latestInvoice.totalAmount)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${invStatus(r.latestInvoice.status)}`}>
                            {t(`admin.billing.status.${r.latestInvoice.status}`)}
                          </span>
                        </span>
                      ) : (
                        <span className='text-xs text-warm-gray'>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.hasCard
                        ? <Check size={15} className='text-green-600' />
                        : <span className='text-xs text-warm-gray'>{t('admin.billing.no_card')}</span>}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2 justify-end'>
                        {r.latestInvoice && r.latestInvoice.status !== 'paid' && (
                          <Button variant='outline' size='sm' disabled={markPaid.isPending}
                            onClick={() => markPaid.mutate(r.latestInvoice!.id)}>
                            {t('admin.collection.mark_paid')}
                          </Button>
                        )}
                        {r.billingBlocked && (
                          <Button variant='outline' size='sm' disabled={unblock.isPending}
                            onClick={() => unblock.mutate(r.adminId)}>
                            {t('admin.collection.unblock')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
