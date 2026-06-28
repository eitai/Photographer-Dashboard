import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { getSupplierSettlement } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet } from 'lucide-react';

const fmt = (n: number) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

export const SupplierSettlement = () => {
  const { t, dir } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ['supplier', 'settlement'], queryFn: getSupplierSettlement });

  return (
    <div className='p-6 md:p-8 max-w-3xl' dir={dir}>
      <div className='flex items-center gap-3 mb-8'>
        <Wallet size={22} className='text-foreground' />
        <h1 className='text-2xl font-semibold text-foreground tracking-tight'>{t('supplier.settlement.title')}</h1>
      </div>

      {isLoading ? (
        <Skeleton className='h-40 rounded-2xl' />
      ) : !data ? (
        <p className='text-muted-foreground text-sm'>{t('supplier.settlement.none')}</p>
      ) : (
        <>
          {/* Open balance */}
          <div className='rounded-2xl bg-primary text-primary-foreground p-6 mb-8'>
            <p className='text-xs uppercase tracking-widest opacity-60'>{t('supplier.settlement.owed')}</p>
            <p className='text-3xl font-semibold mt-2'>{fmt(data.open.total)}</p>
            <p className='text-sm opacity-70 mt-1'>{data.open.orderCount} {t('orders.items')}</p>
          </div>

          {/* History */}
          <h2 className='text-sm font-semibold uppercase tracking-widest text-foreground mb-3'>
            {t('supplier.settlement.history')}
          </h2>
          {data.history.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{t('supplier.settlement.none')}</p>
          ) : (
            <div className='bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border'>
              {data.history.map((h) => (
                <div key={h.id} className='flex items-center justify-between px-5 py-3.5'>
                  <span className='text-sm text-foreground'>
                    {new Date(h.periodStart).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}
                    {' – '}
                    {new Date(h.periodEnd).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}
                  </span>
                  <span className='flex items-center gap-3'>
                    <span className='text-sm font-medium text-foreground'>{fmt(h.totalCost)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === 'settled' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {t(`admin.settlement.status.${h.status}`)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
