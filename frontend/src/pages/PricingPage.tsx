import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { usePublicPlans, useCustomPrice } from '@/hooks/useQueries';
import type { Plan } from '@/lib/api';
import { Check } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const BLUSH = '#E7B8B5';
const GRADIENT = `linear-gradient(135deg, ${BLUSH}, #c89fd4, #8B5CF6)`;
const PLAN_ORDER = ['free', 'basic', 'pro', 'ultra', 'unlimited'];

function fmtStorage(bytes: number | null): string {
  if (bytes === null) return '∞';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${Math.round(gb)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

// ─── Reveal wrapper ───────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Custom plan card (storage slider) ───────────────────────────────────────
function CustomPlanCard({ plan, interval, isPopular, onGetStarted }: {
  plan: Plan; interval: 'monthly' | 'annual'; isPopular: boolean; onGetStarted: (slug?: string) => void;
}) {
  const { t } = useI18n();
  const minGb = plan.customMinGb ?? 1;
  const maxGb = plan.customMaxGb ?? 1000;
  const [gb, setGb] = useState<number>(minGb);
  const { data: customPrice, isLoading } = useCustomPrice(gb, interval);

  function priceDisplay(): string {
    if (isLoading || !customPrice) return '…';
    const price = interval === 'monthly' ? customPrice.totalMonthly : customPrice.totalAnnual;
    return `₪${price.toFixed(0)}`;
  }

  return (
    <div
      className='relative flex flex-col rounded-2xl p-6 gap-4 transition-all duration-300 hover:-translate-y-1'
      style={isPopular
        ? { background: '#fff', border: `1px solid ${BLUSH}55`, boxShadow: `0 8px 40px rgba(139,92,246,0.15)` }
        : { background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
    >
      {isPopular && (
        <div className='absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap'
          style={{ background: GRADIENT }}>
          {t('landing.pricing.popular')}
        </div>
      )}

      <div>
        <p className='text-base font-semibold text-gray-900'>{plan.name}</p>
        <p className='text-xs text-gray-400 mt-0.5'>{gb} GB {t('landing.pricing.storage')}</p>
      </div>

      <div>
        <span className='text-3xl font-bold text-gray-900'>{priceDisplay()}</span>
        <span className='text-sm text-gray-400 ml-1'>{t('landing.pricing.per_month')}</span>
        {interval === 'annual' && (
          <p className='text-xs text-green-500 mt-0.5'>{t('pricing.annual')} · {t('pricing.annual_discount')}</p>
        )}
      </div>

      <div className='space-y-1'>
        <p className='text-xs text-gray-400'>{t('pricing.custom_slider_label')}</p>
        <input
          type='range' min={minGb} max={maxGb} step={1} value={gb}
          onChange={(e) => setGb(Number(e.target.value))}
          className='w-full accent-[#E7B8B5]'
          aria-label={t('pricing.custom_slider_label')}
        />
        <div className='flex justify-between text-[10px] text-gray-400'>
          <span>{minGb} GB</span>
          <span>{maxGb} GB</span>
        </div>
      </div>

      <ul className='flex-1 space-y-2 text-sm'>
        <li className='flex items-center gap-2 text-gray-600'>
          <Check size={13} style={{ color: BLUSH }} className='shrink-0' />
          {gb} GB {t('landing.pricing.storage')}
        </li>
        <li className='flex items-center gap-2 text-gray-600'>
          <Check size={13} style={{ color: BLUSH }} className='shrink-0' />
          {t('landing.pricing.unlimited_galleries')}
        </li>
        <li className='flex items-center gap-2 text-gray-600'>
          <Check size={13} style={{ color: BLUSH }} className='shrink-0' />
          {t('landing.pricing.all_features')}
        </li>
        <li className='flex items-center gap-2 text-gray-600'>
          <Check size={13} style={{ color: BLUSH }} className='shrink-0' />
          {t('landing.pricing.priority_support')}
        </li>
      </ul>

      <button
        onClick={() => onGetStarted(plan.slug)}
        className='w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-white'
        style={{ background: isPopular ? GRADIENT : 'rgba(0,0,0,0.06)', color: isPopular ? 'white' : '#374151' }}
      >
        {t('landing.pricing.cta_paid')}
      </button>
    </div>
  );
}

// ─── Fixed plan card ──────────────────────────────────────────────────────────
function FixedPlanCard({ plan, interval, isPopular, onGetStarted }: {
  plan: Plan; interval: 'monthly' | 'annual'; isPopular: boolean; onGetStarted: (slug?: string) => void;
}) {
  const { t } = useI18n();
  const isFree = plan.slug === 'free';
  const price = interval === 'annual' ? plan.priceAnnualIls / 12 : plan.priceMonthlyIls;
  const storage = fmtStorage(plan.storageBytes);

  return (
    <div
      className='relative flex flex-col rounded-2xl p-6 gap-4 transition-all duration-300 hover:-translate-y-1'
      style={isPopular
        ? { background: '#fff', border: `1px solid ${BLUSH}55`, boxShadow: `0 8px 40px rgba(139,92,246,0.15)` }
        : { background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
    >
      {isPopular && (
        <div className='absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap'
          style={{ background: GRADIENT }}>
          {t('landing.pricing.popular')}
        </div>
      )}

      <div>
        <p className='text-base font-semibold text-gray-900'>{plan.name}</p>
        <p className='text-xs text-gray-400 mt-0.5'>{storage} {t('landing.pricing.storage')}</p>
      </div>

      <div>
        {isFree ? (
          <>
            <span className='text-3xl font-bold text-gray-900'>{t('landing.pricing.cta_free')}</span>
            <p className='text-xs text-gray-400 mt-0.5'>{t('landing.pricing.forever')}</p>
          </>
        ) : (
          <>
            <span className='text-3xl font-bold text-gray-900'>₪{price % 1 === 0 ? price : price.toFixed(1)}</span>
            <span className='text-sm text-gray-400 ml-1'>{t('landing.pricing.per_month')}</span>
            {interval === 'annual' && (
              <p className='text-xs text-green-500 mt-0.5'>{t('pricing.annual')} · {t('pricing.annual_discount')}</p>
            )}
          </>
        )}
      </div>

      <ul className='flex-1 space-y-2 text-sm'>
        <li className='flex items-center gap-2 text-gray-600'>
          <Check size={13} style={{ color: BLUSH }} className='shrink-0' />
          {storage} {t('landing.pricing.storage')}
        </li>
        <li className='flex items-center gap-2 text-gray-600'>
          <Check size={13} style={{ color: BLUSH }} className='shrink-0' />
          {t('landing.pricing.unlimited_galleries')}
        </li>
        <li className='flex items-center gap-2 text-gray-600'>
          <Check size={13} style={{ color: BLUSH }} className='shrink-0' />
          {t('landing.pricing.all_features')}
        </li>
        {!isFree && (
          <li className='flex items-center gap-2 text-gray-600'>
            <Check size={13} style={{ color: BLUSH }} className='shrink-0' />
            {t('landing.pricing.priority_support')}
          </li>
        )}
      </ul>

      <button
        onClick={() => onGetStarted(plan.slug)}
        className='w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300'
        style={isPopular
          ? { background: GRADIENT, color: 'white' }
          : isFree
            ? { background: 'rgba(0,0,0,0.04)', color: '#374151', border: '1px solid rgba(0,0,0,0.07)' }
            : { background: 'rgba(0,0,0,0.04)', color: '#374151', border: '1px solid rgba(0,0,0,0.07)' }}
      >
        {isFree ? t('landing.pricing.cta_free') : t('landing.pricing.cta_paid')}
      </button>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PlanSkeleton() {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className='h-80 rounded-2xl animate-pulse bg-gray-100' />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export const PricingPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const { data: plans = [], isLoading } = usePublicPlans();

  const activePlans = plans
    .filter((p) => p.isActive)
    .sort((a, b) => PLAN_ORDER.indexOf(a.slug) - PLAN_ORDER.indexOf(b.slug));

  const fixedPlans = activePlans.filter((p) => p.slug !== 'custom');
  const customPlan = activePlans.find((p) => p.slug === 'custom');

  function openRegister(slug?: string) {
    navigate(slug ? `/get-started?plan=${slug}&interval=${interval}` : '/get-started');
  }

  return (
    <div className='min-h-screen' style={{ background: '#FAF8F4' }}>

      {/* ── Hero ── */}
      <div className='pt-24 pb-12 px-6 text-center'>
        <Reveal>
          <span className='inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-5'
            style={{ background: `${BLUSH}22`, color: '#b07c79' }}>
            {t('landing.pricing.badge')}
          </span>
        </Reveal>
        <Reveal delay={0.07}>
          <h1 className='text-4xl md:text-6xl font-light mb-4' style={{ color: '#1a1a1a' }}>
            {t('landing.pricing.title_new')}{' '}
            <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {t('landing.pricing.title_accent')}
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className='text-lg text-gray-500 max-w-xl mx-auto mb-10'>
            {t('landing.pricing.subtitle_new')}
          </p>
        </Reveal>

        {/* Toggle */}
        <Reveal delay={0.16}>
          <div className='inline-flex items-center gap-1 p-1 rounded-full bg-white border border-gray-200 shadow-sm'>
            {(['monthly', 'annual'] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className='px-5 py-2 rounded-full text-sm transition-all duration-300'
                style={interval === iv
                  ? { background: GRADIENT, color: 'white', fontWeight: 500 }
                  : { color: '#6b7280' }}
              >
                {iv === 'monthly' ? t('landing.pricing.monthly') : (
                  <span className='flex items-center gap-2'>
                    {t('landing.pricing.annual')}
                    <span className='text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 font-semibold'>
                      {t('pricing.annual_discount')}
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </Reveal>
      </div>

      {/* ── Plans grid ── */}
      <div className='max-w-6xl mx-auto px-6 pb-8'>
        {isLoading ? (
          <PlanSkeleton />
        ) : (
          <>
            {/* Fixed plans */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6'>
              {fixedPlans.map((plan, i) => {
                const isPro = plan.slug === 'pro';
                return (
                  <Reveal key={plan.id} delay={0.06 * i}>
                    <FixedPlanCard
                      plan={plan}
                      interval={interval}
                      isPopular={isPro}
                      onGetStarted={openRegister}
                    />
                  </Reveal>
                );
              })}
            </div>

            {/* Custom plan (full width) */}
            {customPlan && (
              <Reveal delay={0.3}>
                <div className='max-w-lg mx-auto'>
                  <CustomPlanCard
                    plan={customPlan}
                    interval={interval}
                    isPopular={false}
                    onGetStarted={openRegister}
                  />
                </div>
              </Reveal>
            )}
          </>
        )}
      </div>

      {/* ── All features included note ── */}
      <Reveal delay={0.1}>
        <p className='text-center text-xs text-gray-400 pb-20 px-6 max-w-2xl mx-auto'>
          {t('landing.pricing.fine_print')}
        </p>
      </Reveal>

      {/* ── Feature highlights ── */}
      <div className='py-16 px-6' style={{ background: '#ffffff' }}>
        <div className='max-w-4xl mx-auto'>
          <Reveal className='text-center mb-10'>
            <h2 className='text-2xl md:text-3xl font-light mb-2' style={{ color: '#1a1a1a' }}>
              {t('landing.pricing.all_features')}
            </h2>
            <p className='text-gray-500 text-sm'>{t('landing.pricing.subtitle_new')}</p>
          </Reveal>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
            {[
              { icon: '🖼️', label: t('landing.pricing.unlimited_galleries') },
              { icon: '🏪', label: t('landing.pricing.product_store') },
              { icon: '📱', label: t('landing.pricing.mobile_app') },
              { icon: '🎨', label: t('landing.pricing.all_themes') },
              { icon: '📊', label: t('landing.pricing.analytics') },
              { icon: '💬', label: t('landing.pricing.priority_support') },
            ].map(({ icon, label }, i) => (
              <Reveal key={label} delay={0.05 * i}>
                <div className='flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 shadow-sm'>
                  <span className='text-2xl'>{icon}</span>
                  <span className='text-sm text-gray-700 font-medium'>{label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className='py-20 px-6 text-center' style={{ background: '#FAF8F4' }}>
        <Reveal>
          <h2 className='text-3xl font-light mb-4' style={{ color: '#1a1a1a' }}>
            {t('landing.pricing.cta_heading')}
          </h2>
          <p className='text-gray-500 mb-8 max-w-md mx-auto text-sm'>
            {t('landing.pricing.cta_desc')}
          </p>
          <button
            onClick={() => openRegister('free')}
            className='px-8 py-3.5 rounded-full text-sm font-semibold text-white transition-transform hover:scale-105'
            style={{ background: GRADIENT }}
          >
            {t('landing.pricing.cta_free')}
          </button>
        </Reveal>
      </div>

    </div>
  );
};
