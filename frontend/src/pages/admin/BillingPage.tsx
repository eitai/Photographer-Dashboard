import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StorageBar } from '@/components/admin/StorageBar';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import {
  useMyPlan,
  usePublicPlans,
  useCheckoutPlan,
  useCancelSubscription,
  useReactivateSubscription,
  useInvoices,
  useCustomPrice,
} from '@/hooks/useQueries';
import { cn } from '@/lib/utils';
import { CreditCard, Clock, CheckCircle, AlertCircle, HardDrive, History } from 'lucide-react';
import type { Plan } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/admin/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function storageGbLabel(plan: Plan): string {
  if (plan.storageBytes === null) return '∞';
  const gb = plan.storageBytes / 1024 ** 3;
  return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)} GB`;
}

function formatAmountIls(amount: number | null): string {
  if (amount === null) return '—';
  return `₪${(amount / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Subscription status badge
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: string;
  cancelAtPeriodEnd: boolean;
}

function SubscriptionStatusBadge({ status, cancelAtPeriodEnd }: StatusBadgeProps) {
  const { t } = useI18n();

  if (cancelAtPeriodEnd) {
    return (
      <Badge variant='outline' className='text-amber-600 border-amber-300 bg-amber-50 text-xs gap-1'>
        <Clock size={11} />
        {t('admin.billing.cancel_at_period_end')}
      </Badge>
    );
  }

  const map: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
    active: { label: t('admin.billing.status_active'), className: 'text-green-600 border-green-300 bg-green-50', icon: CheckCircle },
    trialing: { label: t('admin.billing.status_trialing'), className: 'text-blue-600 border-blue-300 bg-blue-50', icon: CheckCircle },
    past_due: { label: t('admin.billing.status_past_due'), className: 'text-red-600 border-red-300 bg-red-50', icon: AlertCircle },
    canceled: { label: t('admin.billing.status_canceled'), className: 'text-warm-gray border-beige bg-ivory', icon: AlertCircle },
  };

  const meta = map[status] ?? { label: t('admin.billing.status_inactive'), className: 'text-warm-gray border-beige bg-ivory', icon: AlertCircle };
  const Icon = meta.icon;

  return (
    <Badge variant='outline' className={cn('text-xs gap-1', meta.className)}>
      <Icon size={11} />
      {meta.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Upgrade modal
// ---------------------------------------------------------------------------

interface UpgradeModalProps {
  plan: Plan;
  open: boolean;
  onClose: () => void;
}

function UpgradeModal({ plan, open, onClose }: UpgradeModalProps) {
  const { t } = useI18n();
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [customGb, setCustomGb] = useState<number>(
    plan.customMinGb ?? 10,
  );
  const checkout = useCheckoutPlan();

  const isCustom = plan.slug === 'custom';
  const minGb = plan.customMinGb ?? 1;
  const maxGb = plan.customMaxGb ?? 1000;

  const { data: customPrice } = useCustomPrice(customGb, interval, isCustom && open);

  function displayPrice(): string {
    if (isCustom) {
      if (!customPrice) return '…';
      const price = interval === 'monthly' ? customPrice.totalMonthly : customPrice.totalAnnual;
      const key = interval === 'monthly' ? 'admin.billing.monthly_price' : 'admin.billing.annual_price';
      return t(key).replace('{price}', price.toFixed(0));
    }
    const price = interval === 'monthly' ? plan.priceMonthlyIls : plan.priceAnnualIls;
    const key = interval === 'monthly' ? 'admin.billing.monthly_price' : 'admin.billing.annual_price';
    return t(key).replace('{price}', price.toFixed(0));
  }

  function handleConfirm() {
    checkout.mutate(
      { planId: plan.id, billingInterval: interval, customStorageGb: isCustom ? customGb : undefined },
      {
        onError: () => toast.error(t('admin.billing.payment_failed')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>{plan.name}</DialogTitle>
        </DialogHeader>

        {/* Interval toggle */}
        <div className='space-y-1'>
          <p className='text-xs text-warm-gray font-medium'>{t('admin.billing.upgrade_select_interval')}</p>
          <div className='flex gap-2'>
            {(['monthly', 'annual'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setInterval(opt)}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                  interval === opt
                    ? 'border-blush bg-blush/10 text-blush'
                    : 'border-beige bg-white text-warm-gray hover:border-blush/40',
                )}
              >
                {opt === 'monthly' ? t('admin.billing.upgrade_monthly') : t('admin.billing.upgrade_annual')}
              </button>
            ))}
          </div>
        </div>

        {/* Custom GB slider */}
        {isCustom && (
          <div className='space-y-1'>
            <p className='text-xs text-warm-gray font-medium'>
              {t('admin.billing.upgrade_custom_gb')}
              <span className='ms-1 text-charcoal font-semibold'>{customGb} GB</span>
            </p>
            <input
              type='range'
              min={minGb}
              max={maxGb}
              step={1}
              value={customGb}
              onChange={(e) => setCustomGb(Number(e.target.value))}
              aria-label={t('pricing.custom_slider_label')}
              className='w-full accent-blush'
            />
            <div className='flex justify-between text-[10px] text-warm-gray'>
              <span>{minGb} GB</span>
              <span>{maxGb} GB</span>
            </div>
          </div>
        )}

        {/* Price display */}
        <p className='text-xl font-bold text-charcoal'>{displayPrice()}</p>

        <DialogFooter className='gap-2'>
          <Button variant='ghost' size='sm' onClick={onClose} disabled={checkout.isPending}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            size='sm'
            onClick={handleConfirm}
            disabled={checkout.isPending}
          >
            {checkout.isPending ? t('admin.billing.processing') : t('admin.billing.upgrade_confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Cancel confirmation dialog
// ---------------------------------------------------------------------------

interface CancelDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

function CancelDialog({ open, onClose, onConfirm, isPending }: CancelDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('admin.billing.cancel_confirm_title')}</DialogTitle>
          <DialogDescription>{t('admin.billing.cancel_confirm_body')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className='gap-2'>
          <Button variant='ghost' size='sm' onClick={onClose} disabled={isPending}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            size='sm'
            variant='danger'
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? t('admin.billing.processing') : t('admin.billing.cancel_btn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Upgrade card
// ---------------------------------------------------------------------------

interface UpgradeCardProps {
  plan: Plan;
  isCurrent: boolean;
}

function UpgradeCard({ plan, isCurrent }: UpgradeCardProps) {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);

  const priceLabel =
    plan.priceMonthlyIls === 0
      ? t('admin.billing.free')
      : t('admin.billing.monthly_price').replace('{price}', plan.priceMonthlyIls.toFixed(0));

  return (
    <>
      <div
        className={cn(
          'border rounded-xl p-4 flex flex-col gap-2 bg-white',
          isCurrent ? 'border-blush ring-1 ring-blush/40' : 'border-beige',
        )}
      >
        <div className='flex items-start justify-between gap-2'>
          <div>
            <p className='text-sm font-semibold text-charcoal'>{plan.name}</p>
            <p className='text-xs text-warm-gray mt-0.5'>
              {plan.slug === 'custom'
                ? t('admin.billing.custom_storage')
                : storageGbLabel(plan) + ' ' + t('admin.billing.storage_gb')}
            </p>
          </div>
          {isCurrent && (
            <Badge variant='outline' className='text-blush border-blush/40 bg-blush/10 text-[10px] shrink-0'>
              {t('admin.billing.current_badge')}
            </Badge>
          )}
        </div>

        <p className='text-base font-bold text-charcoal'>{priceLabel}</p>

        {isCurrent ? (
          <button
            disabled
            className='mt-1 w-full rounded-lg border border-beige bg-ivory text-xs text-warm-gray py-1.5 cursor-default'
          >
            {t('admin.billing.current_badge')}
          </button>
        ) : (
          <Button
            variant='ghost'
            size='sm'
            className='mt-1 w-full'
            onClick={() => setModalOpen(true)}
          >
            {t('admin.billing.upgrade_btn')}
          </Button>
        )}
      </div>

      {modalOpen && (
        <UpgradeModal plan={plan} open={modalOpen} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Billing history section
// ---------------------------------------------------------------------------

function BillingHistory() {
  const { t } = useI18n();
  const { data, isLoading } = useInvoices(1);

  if (isLoading) {
    return (
      <div className='space-y-2'>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className='h-8 w-full rounded-lg' />
        ))}
      </div>
    );
  }

  const invoices = data?.invoices ?? [];

  if (invoices.length === 0) {
    return (
      <p className='text-sm text-warm-gray py-4 text-center'>
        {t('admin.billing.no_invoices')}
      </p>
    );
  }

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs'>
        <thead>
          <tr className='border-b border-beige text-warm-gray'>
            <th className='text-start py-2 pe-4 font-medium'>{t('admin.billing.invoice_date')}</th>
            <th className='text-start py-2 pe-4 font-medium'>{t('admin.billing.invoice_type')}</th>
            <th className='text-end py-2 font-medium'>{t('admin.billing.invoice_amount')}</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className='border-b border-beige/50 hover:bg-ivory/60 transition-colors'>
              <td className='py-2 pe-4 text-charcoal'>{formatDate(inv.created_at)}</td>
              <td className='py-2 pe-4 text-charcoal capitalize'>{inv.type}</td>
              <td className='py-2 text-end text-charcoal font-medium'>{formatAmountIls(inv.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function BillingPageSkeleton() {
  return (
    <div className='space-y-6 pb-10'>
      <div className='rounded-2xl border border-beige bg-white p-5 space-y-3'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-6 w-24' />
        <Skeleton className='h-4 w-48' />
      </div>
      <div className='rounded-2xl border border-beige bg-white p-5 space-y-3'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-2 w-full rounded-full' />
        <Skeleton className='h-3 w-40' />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const BillingPage = () => {
  const { t } = useI18n();
  const { data: myPlan, isLoading: planLoading, isError: planError } = useMyPlan();
  const { data: allPlans = [], isLoading: plansLoading } = usePublicPlans();
  const cancelMutation = useCancelSubscription();
  const reactivateMutation = useReactivateSubscription();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Handle payment result from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') {
      toast.success(t('admin.billing.payment_success'));
    } else if (payment === 'failed') {
      toast.error(t('admin.billing.payment_failed'));
    }
    if (payment) {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      window.history.replaceState({}, '', url.toString());
    }
  }, [t]);

  useEffect(() => {
    if (planError) toast.error(t('admin.billing.load_failed'));
  }, [planError, t]);

  const isLoading = planLoading || plansLoading;

  const storageUsedGB = myPlan ? myPlan.storage.usedGb : 0;
  const storageQuotaGB = myPlan ? myPlan.storage.quotaGb : null;
  const percentUsed = myPlan ? myPlan.storage.percentUsed : 0;
  const isUnlimited = storageQuotaGB === null;

  const currentPlanId = myPlan?.plan.id;
  const planSlug = myPlan?.plan.slug ?? 'free';
  const otherPlans = allPlans.filter((p) => p.isActive && p.id !== currentPlanId);
  const cancelAtPeriodEnd = myPlan?.subscription.cancelAtPeriodEnd ?? false;
  const hasPaidPlan = planSlug !== 'free';

  function handleCancelConfirm() {
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('admin.billing.cancel_confirm_title'));
        setCancelDialogOpen(false);
      },
      onError: () => toast.error(t('admin.common.error')),
    });
  }

  function handleReactivate() {
    reactivateMutation.mutate(undefined, {
      onSuccess: () => toast.success(t('admin.billing.reactivate_btn')),
      onError: () => toast.error(t('admin.common.error')),
    });
  }

  return (
    <AdminLayout title={t('admin.billing.title')}>
      {isLoading ? (
        <BillingPageSkeleton />
      ) : (
        <div className='max-w-2xl mx-auto space-y-6 pb-10 pt-2'>

          {/* ── Current Plan card ─────────────────────────────────────── */}
          <section className='rounded-2xl border border-beige bg-white p-5 space-y-4'>
            <div className='flex items-center gap-2 text-xs font-medium text-warm-gray uppercase tracking-wide'>
              <CreditCard size={14} />
              {t('admin.billing.current_plan')}
            </div>

            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold font-serif text-charcoal'>
                  {myPlan?.plan.name ?? t('admin.billing.free')}
                </h2>
                {myPlan?.subscription && (
                  <p className='text-xs text-warm-gray mt-0.5'>
                    {myPlan.subscription.billingInterval === 'monthly'
                      ? t('admin.billing.billing_interval_monthly')
                      : t('admin.billing.billing_interval_annual')}
                    {myPlan.subscription.customStorageGb != null && (
                      <span className='ms-1'>
                        · {t('admin.billing.custom_gb').replace('{gb}', String(myPlan.subscription.customStorageGb))}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {myPlan?.subscription && (
                <SubscriptionStatusBadge
                  status={myPlan.subscription.status}
                  cancelAtPeriodEnd={cancelAtPeriodEnd}
                />
              )}
            </div>

            {/* Next billing date */}
            {myPlan?.subscription?.currentPeriodEnd && !cancelAtPeriodEnd && (
              <div className='flex items-center gap-1.5 text-xs text-warm-gray'>
                <Clock size={12} />
                <span>
                  {t('admin.billing.next_billing')}:{' '}
                  <span className='text-charcoal font-medium'>
                    {formatDate(myPlan.subscription.currentPeriodEnd)}
                  </span>
                </span>
              </div>
            )}

            {/* Cancel / Reactivate actions */}
            {hasPaidPlan && (
              <div className='pt-1 flex gap-2 flex-wrap'>
                {cancelAtPeriodEnd ? (
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={handleReactivate}
                    disabled={reactivateMutation.isPending}
                  >
                    {reactivateMutation.isPending
                      ? t('admin.billing.processing')
                      : t('admin.billing.reactivate_btn')}
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='text-red-500 hover:text-red-600 hover:bg-red-50'
                        onClick={() => setCancelDialogOpen(true)}
                      >
                        {t('admin.billing.cancel_btn')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className='text-xs'>{t('admin.billing.cancel_confirm_body')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </section>

          {/* ── Storage section ────────────────────────────────────────── */}
          <section className='rounded-2xl border border-beige bg-white p-5 space-y-3'>
            <div className='flex items-center gap-2 text-xs font-medium text-warm-gray uppercase tracking-wide'>
              <HardDrive size={14} />
              {t('admin.billing.storage_section')}
            </div>

            <StorageBar
              usedGB={storageUsedGB}
              quotaGB={storageQuotaGB}
              percentUsed={percentUsed}
              unlimited={isUnlimited}
            />

            <p className='text-xs text-warm-gray'>
              {storageUsedGB.toFixed(2)} GB {t('storage.of')}{' '}
              {isUnlimited ? t('admin.billing.unlimited') : `${storageQuotaGB?.toFixed(2)} GB`}
            </p>
          </section>

          {/* ── Upgrade section ────────────────────────────────────────── */}
          {otherPlans.length > 0 && (
            <section className='rounded-2xl border border-beige bg-white p-5 space-y-4'>
              <div className='text-xs font-medium text-warm-gray uppercase tracking-wide'>
                {t('admin.billing.upgrade_section')}
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {myPlan && (
                  <UpgradeCard plan={myPlan.plan} isCurrent />
                )}
                {otherPlans.map((plan) => (
                  <UpgradeCard key={plan.id} plan={plan} isCurrent={false} />
                ))}
              </div>
            </section>
          )}

          {/* ── Billing History ────────────────────────────────────────── */}
          <section className='rounded-2xl border border-beige bg-white p-5 space-y-3'>
            <div className='flex items-center gap-2 text-xs font-medium text-warm-gray uppercase tracking-wide'>
              <History size={14} />
              {t('admin.billing.history_section')}
            </div>

            <BillingHistory />
          </section>

        </div>
      )}

      <CancelDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        isPending={cancelMutation.isPending}
      />
    </AdminLayout>
  );
};
