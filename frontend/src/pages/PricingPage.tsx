import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { usePublicPlans, useCustomPrice } from '@/hooks/useQueries';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Plan } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storageLabel(plan: Plan, t: (k: string) => string): string {
  if (plan.storageBytes === null) return t('pricing.unlimited_storage');
  const gb = plan.storageBytes / 1024 ** 3;
  const gbStr = gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1);
  return t('pricing.storage') + ': ' + gbStr + ' GB';
}

// ---------------------------------------------------------------------------
// Custom plan card (with slider)
// ---------------------------------------------------------------------------

interface CustomPlanCardProps {
  plan: Plan;
  interval: 'monthly' | 'annual';
  isPopular: boolean;
}

function CustomPlanCard({ plan, interval, isPopular }: CustomPlanCardProps) {
  const { t } = useI18n();
  const minGb = plan.customMinGb ?? 1;
  const maxGb = plan.customMaxGb ?? 1000;
  const [gb, setGb] = useState<number>(minGb);

  const { data: customPrice, isLoading } = useCustomPrice(gb, interval);

  function priceDisplay(): string {
    if (isLoading || !customPrice) return '…';
    const price = interval === 'monthly' ? customPrice.totalMonthly : customPrice.totalAnnual;
    const key = interval === 'monthly' ? 'pricing.custom_monthly_price' : 'pricing.custom_annual_price';
    return t(key).replace('{price}', price.toFixed(0));
  }

  const storageStr = t('pricing.custom_gb_label').replace('{gb}', String(gb));

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-white p-6 gap-4 shadow-sm',
        isPopular ? 'border-blush ring-2 ring-blush/30' : 'border-beige',
      )}
    >
      {isPopular && (
        <span className='absolute -top-3 start-1/2 -translate-x-1/2 bg-blush text-white text-[10px] font-semibold px-3 py-0.5 rounded-full'>
          {t('pricing.popular')}
        </span>
      )}

      <div>
        <p className='text-base font-semibold text-charcoal'>{plan.name}</p>
        <p className='text-xs text-warm-gray mt-0.5'>{storageStr}</p>
      </div>

      <p className='text-2xl font-bold text-charcoal'>{priceDisplay()}</p>

      {/* Slider */}
      <div className='space-y-1'>
        <p className='text-xs text-warm-gray'>{t('pricing.custom_slider_label')}</p>
        <input
          type='range'
          min={minGb}
          max={maxGb}
          step={1}
          value={gb}
          onChange={(e) => setGb(Number(e.target.value))}
          aria-label={t('pricing.custom_slider_label')}
          className='w-full accent-blush'
        />
        <div className='flex justify-between text-[10px] text-warm-gray'>
          <span>{minGb} GB</span>
          <span>{maxGb} GB</span>
        </div>
      </div>

      <ul className='space-y-1.5 flex-1'>
        <li className='flex items-center gap-2 text-xs text-charcoal'>
          <Check size={13} className='text-blush shrink-0' />
          {storageStr}
        </li>
      </ul>

      <Link
        to='/admin/billing'
        className={cn(
          'mt-auto w-full rounded-xl py-2 text-center text-sm font-medium transition-colors',
          isPopular
            ? 'bg-blush text-white hover:bg-blush/80'
            : 'border border-beige text-charcoal hover:bg-ivory',
        )}
      >
        {t('pricing.cta')}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fixed plan card
// ---------------------------------------------------------------------------

interface FixedPlanCardProps {
  plan: Plan;
  interval: 'monthly' | 'annual';
  isPopular: boolean;
}

function FixedPlanCard({ plan, interval, isPopular }: FixedPlanCardProps) {
  const { t } = useI18n();
  const isFree = plan.priceMonthlyIls === 0;

  function priceDisplay(): string {
    if (isFree) return t('admin.billing.free');
    const price = interval === 'monthly' ? plan.priceMonthlyIls : plan.priceAnnualIls;
    const key = interval === 'monthly' ? 'pricing.custom_monthly_price' : 'pricing.custom_annual_price';
    return t(key).replace('{price}', price.toFixed(0));
  }

  const label = storageLabel(plan, t);

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-white p-6 gap-4 shadow-sm',
        isPopular ? 'border-blush ring-2 ring-blush/30' : 'border-beige',
      )}
    >
      {isPopular && (
        <span className='absolute -top-3 start-1/2 -translate-x-1/2 bg-blush text-white text-[10px] font-semibold px-3 py-0.5 rounded-full'>
          {t('pricing.popular')}
        </span>
      )}

      <div>
        <p className='text-base font-semibold text-charcoal'>{plan.name}</p>
        <p className='text-xs text-warm-gray mt-0.5'>{label}</p>
      </div>

      <p className='text-2xl font-bold text-charcoal'>{priceDisplay()}</p>

      <ul className='space-y-1.5 flex-1'>
        <li className='flex items-center gap-2 text-xs text-charcoal'>
          <Check size={13} className='text-blush shrink-0' />
          {label}
        </li>
      </ul>

      <Link
        to={isFree ? '/admin' : '/admin/billing'}
        className={cn(
          'mt-auto w-full rounded-xl py-2 text-center text-sm font-medium transition-colors',
          isPopular
            ? 'bg-blush text-white hover:bg-blush/80'
            : 'border border-beige text-charcoal hover:bg-ivory',
        )}
      >
        {isFree ? t('pricing.free_cta') : t('pricing.cta')}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PricingPageSkeleton() {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className='rounded-2xl border border-beige bg-white p-6 space-y-4'>
          <Skeleton className='h-5 w-24' />
          <Skeleton className='h-8 w-16' />
          <Skeleton className='h-3 w-full' />
          <Skeleton className='h-9 w-full rounded-xl' />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const PricingPage = () => {
  const { t } = useI18n();
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const { data: plans = [], isLoading } = usePublicPlans();

  // The "popular" plan is index 2 (Pro) among active plans
  const activePlans = plans.filter((p) => p.isActive);

  return (
    <section className='min-h-screen bg-ivory py-16 px-4'>
      <div className='max-w-5xl mx-auto space-y-10'>

        {/* Header */}
        <div className='text-center space-y-3'>
          <h1 className='font-serif text-4xl font-semibold text-charcoal'>
            {t('pricing.title')}
          </h1>
          <p className='text-warm-gray text-base max-w-md mx-auto'>
            {t('pricing.subtitle')}
          </p>

          {/* Monthly / Annual toggle */}
          <div className='inline-flex items-center gap-1 bg-white border border-beige rounded-full p-1 mt-2'>
            <button
              onClick={() => setInterval('monthly')}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                interval === 'monthly'
                  ? 'bg-blush text-white'
                  : 'text-warm-gray hover:text-charcoal',
              )}
            >
              {t('pricing.monthly')}
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5',
                interval === 'annual'
                  ? 'bg-blush text-white'
                  : 'text-warm-gray hover:text-charcoal',
              )}
            >
              {t('pricing.annual')}
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  interval === 'annual'
                    ? 'bg-white/20 text-white'
                    : 'bg-blush/10 text-blush',
                )}
              >
                {t('pricing.annual_discount')}
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards grid */}
        {isLoading ? (
          <PricingPageSkeleton />
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
            {activePlans.map((plan, idx) => {
              const isPopular = idx === 2;
              return plan.slug === 'custom' ? (
                <CustomPlanCard
                  key={plan.id}
                  plan={plan}
                  interval={interval}
                  isPopular={isPopular}
                />
              ) : (
                <FixedPlanCard
                  key={plan.id}
                  plan={plan}
                  interval={interval}
                  isPopular={isPopular}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
