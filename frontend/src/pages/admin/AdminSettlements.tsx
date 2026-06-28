import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { getSettlements, createSettlement, markSettlementSettled } from '@/lib/api';
import { downloadCsv } from '@/lib/exportCsv';
import { Download } from 'lucide-react';

const fmt = (n: number) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

export const AdminSettlements = () => {
  const { t, dir } = useI18n();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['settlements'], queryFn: getSettlements });
  const refresh = () => qc.invalidateQueries({ queryKey: ['settlements'] });

  const exportReport = () => {
    const headers = ['ספק', 'סוג', 'תקופה', 'סכום', 'מס׳ הזמנות', 'סטטוס'];
    const csvRows: (string | number)[][] = [];
    let totalOpen = 0;
    for (const s of rows) {
      totalOpen += s.open.total;
      csvRows.push([s.name, t('admin.settlement.open_balance'), '', s.open.total, s.open.orderCount, '']);
      for (const h of s.history) {
        csvRows.push([
          s.name, t('admin.settlement.history'),
          `${new Date(h.periodStart).toLocaleDateString('he-IL')}–${new Date(h.periodEnd).toLocaleDateString('he-IL')}`,
          h.totalCost, h.orderCount, t(`admin.settlement.status.${h.status}`),
        ]);
      }
    }
    downloadCsv('settlements', headers, csvRows, ['סה״כ יתרה פתוחה', '', '', totalOpen, '', '']);
  };

  const create = useMutation({ mutationFn: createSettlement, onSuccess: () => { toast.success(t('admin.settlement.create')); refresh(); }, onError: () => toast.error(t('admin.settlement.nothing')) });
  const settle = useMutation({ mutationFn: (id: string) => markSettlementSettled(id), onSuccess: () => { toast.success(t('admin.settlement.mark_settled')); refresh(); } });

  return (
    <AdminLayout>
      <div className='p-6 space-y-6 max-w-4xl' dir={dir}>
        <div className={`flex items-center justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <h1 className='font-serif text-2xl text-charcoal'>{t('admin.settlement.title')}</h1>
          {rows.length > 0 && (
            <Button variant='outline' size='sm' className='gap-2' onClick={exportReport}>
              <Download size={15} />
              {t('reports.export_csv')}
            </Button>
          )}
        </div>

        {isLoading ? (
          <Skeleton className='h-48 rounded-xl' />
        ) : (
          rows.map((s) => (
            <section key={s.supplierId} className='bg-card rounded-2xl border border-beige p-6 space-y-4'>
              <div className={`flex items-center justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                <div>
                  <h2 className='font-semibold text-charcoal'>{s.name}</h2>
                  <p className='text-sm text-warm-gray'>
                    {t('admin.settlement.open_balance')}: <span className='font-medium text-charcoal'>{fmt(s.open.total)}</span>
                    {' · '}{s.open.orderCount} {t('orders.items')}
                  </p>
                </div>
                <Button
                  onClick={() => create.mutate(s.supplierId)}
                  disabled={create.isPending || s.open.orderCount === 0}
                  className='bg-primary hover:bg-primary/90 text-white'
                >
                  {t('admin.settlement.create')}
                </Button>
              </div>

              {s.history.length > 0 && (
                <div>
                  <h3 className='text-xs font-semibold tracking-widest uppercase text-warm-gray mb-2'>{t('admin.settlement.history')}</h3>
                  <ul className='divide-y divide-beige'>
                    {s.history.map((h) => (
                      <li key={h.id} className='flex items-center justify-between py-2.5'>
                        <span className='text-sm text-charcoal'>
                          {new Date(h.periodStart).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}
                          {' – '}
                          {new Date(h.periodEnd).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}
                        </span>
                        <span className='flex items-center gap-3'>
                          <span className='text-sm font-medium text-charcoal'>{fmt(h.totalCost)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === 'settled' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {t(`admin.settlement.status.${h.status}`)}
                          </span>
                          {h.status === 'open' && (
                            <Button variant='outline' size='sm' disabled={settle.isPending} onClick={() => settle.mutate(h.id)}>
                              {t('admin.settlement.mark_settled')}
                            </Button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </AdminLayout>
  );
};
