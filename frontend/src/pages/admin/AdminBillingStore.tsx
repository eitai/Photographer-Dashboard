import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { getBillingMe, getMyDocuments, startAddCard } from '@/lib/api';
import { CreditCard, AlertTriangle, Check, Clock, FileText, Download } from 'lucide-react';

const fmt = (n: number) => `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

export const AdminBillingStore = () => {
  const { t, dir } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addingCard, setAddingCard] = useState(false);

  const { data, isLoading, refetch } = useQuery({ queryKey: ['billing', 'me'], queryFn: getBillingMe });
  const { data: documents = [] } = useQuery({ queryKey: ['billing', 'documents'], queryFn: getMyDocuments });

  useEffect(() => {
    const card = searchParams.get('card');
    if (!card) return;
    if (card === 'ok') { toast.success(t('admin.billing.card_secured')); refetch(); }
    else if (card === 'fail') toast.error(t('admin.common.error'));
    const next = new URLSearchParams(searchParams);
    next.delete('card');
    setSearchParams(next, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCard = async () => {
    setAddingCard(true);
    try {
      const { url } = await startAddCard();
      window.location.href = url;
    } catch {
      toast.error(t('admin.common.error'));
      setAddingCard(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_payment: 'bg-amber-50 text-amber-700',
      paid: 'bg-green-50 text-green-700',
      failed: 'bg-red-50 text-red-600',
      cancelled: 'bg-ivory text-warm-gray border border-beige',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? ''}`}>
        {t(`admin.billing.status.${status}`)}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className='p-6 space-y-6 max-w-3xl' dir={dir}>
        <h1 className='font-serif text-2xl text-charcoal'>{t('admin.billing.store_title')}</h1>

        {isLoading ? (
          <><Skeleton className='h-32 rounded-xl' /><Skeleton className='h-40 rounded-xl' /></>
        ) : !data ? (
          <p className='text-warm-gray'>{t('admin.common.error')}</p>
        ) : (
          <>
            {data.billingBlocked && (
              <div className='flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700'>
                <AlertTriangle size={16} className='shrink-0' />
                {t('admin.billing.blocked_banner')}
              </div>
            )}

            {/* Card on file */}
            <section className='bg-card rounded-xl border border-beige p-6 space-y-3'>
              <h2 className='font-semibold text-charcoal flex items-center gap-2'>
                <CreditCard size={18} className='text-blush' />
                {t('admin.billing.card_on_file')}
              </h2>
              <p className='text-xs text-warm-gray'>{t('admin.billing.card_hint')}</p>
              {data.hasCardOnFile ? (
                <p className='text-sm text-charcoal flex items-center gap-2'>
                  <Check size={15} className='text-green-600' />
                  {data.cardBrand || 'Card'} •••• {data.cardLast4}
                </p>
              ) : (
                <p className='text-sm text-warm-gray'>{t('admin.billing.no_card')}</p>
              )}
              <div>
                <Button onClick={handleAddCard} disabled={addingCard} className='bg-charcoal hover:bg-charcoal/90 text-white'>
                  {data.hasCardOnFile ? t('admin.billing.replace_card') : t('admin.billing.add_card')}
                </Button>
              </div>
              <p className='text-[11px] text-warm-gray'>{t('admin.billing.card_secured')}</p>
            </section>

            {/* Current cycle */}
            <section className='bg-card rounded-xl border border-beige p-6'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-warm-gray'>{t('admin.billing.current_cycle')}</span>
                <span className='font-serif text-2xl text-charcoal'>{fmt(data.accrued.total)}</span>
              </div>
              <p className='text-xs text-warm-gray mt-1'>
                {t('admin.billing.orders_count').replace('{n}', String(data.accrued.count))}
              </p>
            </section>

            {/* Invoices */}
            <section className='bg-card rounded-xl border border-beige p-6 space-y-3'>
              <h2 className='font-semibold text-charcoal'>{t('admin.billing.invoices')}</h2>
              {data.invoices.length === 0 ? (
                <p className='text-sm text-warm-gray'>{t('admin.billing.no_invoices')}</p>
              ) : (
                <ul className='divide-y divide-beige'>
                  {data.invoices.map((inv) => (
                    <li key={inv.id} className='flex items-center justify-between py-3'>
                      <div className='flex items-center gap-2'>
                        <Clock size={14} className='text-warm-gray' />
                        <span className='text-sm text-charcoal'>
                          {new Date(inv.periodStart).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span className='text-sm font-medium text-charcoal'>{fmt(inv.totalAmount)}</span>
                        {statusBadge(inv.status)}
                        {inv.status === 'failed' && inv.payplusLink && (
                          <a href={inv.payplusLink} className='text-xs text-blush underline'>{t('admin.billing.pay_now')}</a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Documents / receipts */}
            <section className='bg-card rounded-xl border border-beige p-6 space-y-3'>
              <h2 className='font-semibold text-charcoal flex items-center gap-2'>
                <FileText size={18} className='text-blush' />
                {t('admin.docs.title')}
              </h2>
              {documents.length === 0 ? (
                <p className='text-sm text-warm-gray'>{t('admin.docs.none')}</p>
              ) : (
                <ul className='divide-y divide-beige'>
                  {documents.map((d) => (
                    <li key={d.id} className='flex items-center justify-between py-3'>
                      <div>
                        <span className='text-sm text-charcoal'>{t(`admin.docs.type.${d.docType}`)}</span>
                        {d.documentNumber && <span className='text-xs text-warm-gray ms-2'>#{d.documentNumber}</span>}
                        <p className='text-xs text-warm-gray'>
                          {new Date(d.createdAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}
                        </p>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span className='text-sm font-medium text-charcoal'>{fmt(d.amount)}</span>
                        {d.pdfUrl ? (
                          <a href={d.pdfUrl} target='_blank' rel='noreferrer' className='flex items-center gap-1 text-xs text-blush underline'>
                            <Download size={12} /> {t('admin.docs.download')}
                          </a>
                        ) : (
                          <span className='text-xs text-warm-gray'>{t('admin.docs.pending')}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
};
