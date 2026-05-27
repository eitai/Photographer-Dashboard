import { useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StorageBar } from '@/components/admin/StorageBar';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { useMyPlan, usePublicPlans } from '@/hooks/useQueries';
import { cn } from '@/lib/utils';
import { CreditCard, Clock, CheckCircle, AlertCircle, HardDrive, History } from 'lucide-react';
import type { Plan } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/admin/Button';

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
  const gb = plan.storageBytes / (1024 ** 3);
  return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)} GB`;
}

function monthlyPriceLabel(plan: Plan): string {
  if (plan.priceMonthlyIls === 0) return 'Free';
  return `₪${plan.priceMonthlyIls}/mo`;
}

// ---------------------------------------------------------------------------
// Sub-components
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
    active:   { label: t('admin.billing.status_active'),   className: 'text-green-600 border-green-300 bg-green-50',    icon: CheckCircle },
    trialing: { label: t('admin.billing.status_trialing'), className: 'text-blue-600 border-blue-300 bg-blue-50',       icon: CheckCircle },
    past_due: { label: t('admin.billing.status_past_due'), className: 'text-red-600 border-red-300 bg-red-50',          icon: AlertCircle },
    canceled: { label: t('admin.billing.status_canceled'), className: 'text-warm-gray border-beige bg-ivory',           icon: AlertCircle },
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
// Upgrade card
// ---------------------------------------------------------------------------

interface UpgradeCardProps {
  plan: Plan;
  isCurrent: boolean;
}

function UpgradeCard({ plan, isCurrent }: UpgradeCardProps) {
  const { t } = useI18n();

  return (
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

      <p className='text-base font-bold text-charcoal'>{monthlyPriceLabel(plan)}</p>

      {isCurrent ? (
        <button
          disabled
          className='mt-1 w-full rounded-lg border border-beige bg-ivory text-xs text-warm-gray py-1.5 cursor-default'
        >
          {t('admin.billing.current_badge')}
        </button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='mt-1 block'>
              <Button
                variant='ghost'
                size='sm'
                disabled
                className='w-full'
              >
                {t('admin.billing.upgrade_btn')}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className='text-xs'>{t('admin.billing.coming_soon')}</p>
          </TooltipContent>
        </Tooltip>
      )}
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

  useEffect(() => {
    if (planError) toast.error(t('admin.billing.load_failed'));
  }, [planError, t]);

  const isLoading = planLoading || plansLoading;

  // Derive storage values that match the existing StorageBar interface
  const storageUsedGB   = myPlan ? myPlan.storage.usedGb   : 0;
  const storageQuotaGB  = myPlan ? myPlan.storage.quotaGb  : null;
  const percentUsed     = myPlan ? myPlan.storage.percentUsed : 0;
  const isUnlimited     = storageQuotaGB === null;

  const currentPlanId = myPlan?.plan.id;
  // Filter out plans that would be a downgrade (show all non-current plans)
  const otherPlans = allPlans.filter((p) => p.isActive && p.id !== currentPlanId);

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
                  cancelAtPeriodEnd={myPlan.subscription.cancelAtPeriodEnd}
                />
              )}
            </div>

            {/* Next billing date */}
            {myPlan?.subscription?.currentPeriodEnd && !myPlan.subscription.cancelAtPeriodEnd && (
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
                {/* Show current plan card first */}
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

            <p className='text-sm text-warm-gray py-4 text-center'>
              {t('admin.billing.no_history')}
            </p>
          </section>

        </div>
      )}
    </AdminLayout>
  );
};
