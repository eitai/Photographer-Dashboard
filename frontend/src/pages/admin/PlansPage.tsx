import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { useAdminPlans, useUpdateAdminPlan, useCustomPrice } from '@/hooks/useQueries';
import { cn } from '@/lib/utils';
import { Pencil, Check, X } from 'lucide-react';
import type { Plan } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { InputField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BYTES_PER_GB = 1024 ** 3;

function bytesToGb(bytes: number | null): string {
  if (bytes === null) return '';
  return String(Math.round(bytes / BYTES_PER_GB));
}

function isCustomPlan(slug: string): boolean {
  return slug === 'custom';
}

// ---------------------------------------------------------------------------
// Edit form state types
// ---------------------------------------------------------------------------

interface FixedPlanForm {
  name: string;
  description: string;
  storageGb: string;
  unlimitedStorage: boolean;
  priceMonthly: string;
  priceAnnual: string;
  isActive: boolean;
}

interface CustomPlanForm {
  name: string;
  description: string;
  pricePerGb: string;
  minGb: string;
  maxGb: string;
  noMaxGb: boolean;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PlansPageSkeleton() {
  return (
    <div className='space-y-2'>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className='flex gap-3 p-3 border border-beige rounded-lg bg-white'>
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-4 w-20' />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom plan live preview
// ---------------------------------------------------------------------------

interface CustomPreviewProps {
  pricePerGb: number;
  previewGb?: number;
}

function CustomPlanPreview({ pricePerGb, previewGb = 50 }: CustomPreviewProps) {
  const { t } = useI18n();
  const { data: priceData } = useCustomPrice(previewGb, 'monthly', pricePerGb > 0);

  if (!priceData || pricePerGb <= 0) return null;

  return (
    <p className='text-xs text-warm-gray bg-ivory border border-beige rounded-lg px-3 py-2'>
      {t('admin.plans.preview_label')}{' '}
      <span className='text-charcoal font-medium'>
        {t('admin.plans.preview_monthly').replace('{price}', priceData.totalMonthly.toFixed(0))}
      </span>
      {' | '}
      <span className='text-charcoal font-medium'>
        {t('admin.plans.preview_annual').replace('{price}', priceData.totalAnnual.toFixed(0))}
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Fixed plan edit modal
// ---------------------------------------------------------------------------

interface FixedPlanModalProps {
  plan: Plan;
  onClose: () => void;
}

function FixedPlanModal({ plan, onClose }: FixedPlanModalProps) {
  const { t } = useI18n();
  const updateMutation = useUpdateAdminPlan();

  const [form, setForm] = useState<FixedPlanForm>(() => ({
    name: plan.name,
    description: '',
    storageGb: bytesToGb(plan.storageBytes),
    unlimitedStorage: plan.storageBytes === null,
    priceMonthly: String(plan.priceMonthlyIls),
    priceAnnual: String(plan.priceAnnualIls),
    isActive: plan.isActive,
  }));

  const set = (key: keyof FixedPlanForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleAutoCalc = () => {
    const monthly = parseFloat(form.priceMonthly);
    if (!isNaN(monthly)) {
      set('priceAnnual', (monthly * 12 * 0.8).toFixed(0));
    }
  };

  const handleSave = () => {
    const payload: Partial<Plan> = {
      name: form.name,
      storageBytes: form.unlimitedStorage ? null : parseFloat(form.storageGb) * BYTES_PER_GB,
      priceMonthlyIls: parseFloat(form.priceMonthly) || 0,
      priceAnnualIls: parseFloat(form.priceAnnual) || 0,
      isActive: form.isActive,
    };

    updateMutation.mutate(
      { id: plan.id, data: payload },
      {
        onSuccess: () => {
          toast.success(t('admin.plans.save_success'));
          onClose();
        },
        onError: () => toast.error(t('admin.plans.save_failed')),
      },
    );
  };

  const labelClass = 'block text-xs text-warm-gray mb-1';

  return (
    <Modal isOpen onClose={onClose} maxWidth='max-w-md'>
      <div className='space-y-4'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-charcoal'>
            {t('admin.plans.edit_title')} — {plan.slug}
          </h2>
          <button onClick={onClose} className='text-warm-gray hover:text-charcoal transition-colors p-1'>
            <X size={16} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className={labelClass}>{t('admin.plans.field_name')}</label>
          <InputField
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>

        {/* Storage */}
        <div>
          <label className={labelClass}>{t('admin.plans.field_storage_gb')}</label>
          <div className='flex items-center gap-2'>
            <InputField
              type='number'
              min='0'
              value={form.storageGb}
              disabled={form.unlimitedStorage}
              onChange={(e) => set('storageGb', e.target.value)}
              className='w-28'
            />
            <label className='flex items-center gap-1.5 text-xs text-warm-gray cursor-pointer select-none'>
              <input
                type='checkbox'
                checked={form.unlimitedStorage}
                onChange={(e) => set('unlimitedStorage', e.target.checked)}
                className='rounded border-beige accent-blush'
              />
              {t('admin.plans.field_unlimited_storage')}
            </label>
          </div>
        </div>

        {/* Monthly price */}
        <div>
          <label className={labelClass}>{t('admin.plans.field_price_monthly')}</label>
          <InputField
            type='number'
            min='0'
            step='0.01'
            value={form.priceMonthly}
            onChange={(e) => set('priceMonthly', e.target.value)}
          />
        </div>

        {/* Annual price + auto-calc */}
        <div>
          <div className='flex items-center justify-between mb-1'>
            <label className={cn(labelClass, 'mb-0')}>{t('admin.plans.field_price_annual')}</label>
            <button
              type='button'
              onClick={handleAutoCalc}
              className='text-[10px] text-blush underline underline-offset-2 hover:text-blush/80'
            >
              {t('admin.plans.auto_calc')}
            </button>
          </div>
          <InputField
            type='number'
            min='0'
            step='0.01'
            value={form.priceAnnual}
            onChange={(e) => set('priceAnnual', e.target.value)}
          />
        </div>

        {/* Active toggle */}
        <label className='flex items-center gap-2 text-xs text-warm-gray cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className='rounded border-beige accent-blush'
          />
          {t('admin.plans.field_active')}
        </label>

        {/* Actions */}
        <div className='flex items-center justify-end gap-2 pt-2'>
          <Button variant='ghost' size='sm' onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            variant='primary'
            size='sm'
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Custom plan edit modal
// ---------------------------------------------------------------------------

interface CustomPlanModalProps {
  plan: Plan;
  onClose: () => void;
}

function CustomPlanModal({ plan, onClose }: CustomPlanModalProps) {
  const { t } = useI18n();
  const updateMutation = useUpdateAdminPlan();

  const [form, setForm] = useState<CustomPlanForm>(() => ({
    name: plan.name,
    description: '',
    pricePerGb: String(plan.pricePerGbIls ?? ''),
    minGb: String(plan.customMinGb ?? ''),
    maxGb: String(plan.customMaxGb ?? ''),
    noMaxGb: plan.customMaxGb === null,
    isActive: plan.isActive,
  }));

  const set = (key: keyof CustomPlanForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pricePerGbNum = parseFloat(form.pricePerGb) || 0;

  const handleSave = () => {
    const payload: Partial<Plan> = {
      name: form.name,
      pricePerGbIls: pricePerGbNum,
      customMinGb: parseFloat(form.minGb) || null,
      customMaxGb: form.noMaxGb ? null : (parseFloat(form.maxGb) || null),
      isActive: form.isActive,
    };

    updateMutation.mutate(
      { id: plan.id, data: payload },
      {
        onSuccess: () => {
          toast.success(t('admin.plans.save_success'));
          onClose();
        },
        onError: () => toast.error(t('admin.plans.save_failed')),
      },
    );
  };

  const labelClass = 'block text-xs text-warm-gray mb-1';

  return (
    <Modal isOpen onClose={onClose} maxWidth='max-w-md'>
      <div className='space-y-4'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-charcoal'>
            {t('admin.plans.edit_title')} — {plan.slug}
          </h2>
          <button onClick={onClose} className='text-warm-gray hover:text-charcoal transition-colors p-1'>
            <X size={16} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className={labelClass}>{t('admin.plans.field_name')}</label>
          <InputField
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>

        {/* Price per GB */}
        <div>
          <label className={labelClass}>{t('admin.plans.field_price_per_gb')}</label>
          <InputField
            type='number'
            min='0'
            step='0.01'
            value={form.pricePerGb}
            onChange={(e) => set('pricePerGb', e.target.value)}
          />
        </div>

        {/* Min GB */}
        <div>
          <label className={labelClass}>{t('admin.plans.field_min_gb')}</label>
          <InputField
            type='number'
            min='0'
            value={form.minGb}
            onChange={(e) => set('minGb', e.target.value)}
          />
        </div>

        {/* Max GB */}
        <div>
          <div className='flex items-center justify-between mb-1'>
            <label className={cn(labelClass, 'mb-0')}>{t('admin.plans.field_max_gb')}</label>
            <label className='flex items-center gap-1.5 text-xs text-warm-gray cursor-pointer select-none'>
              <input
                type='checkbox'
                checked={form.noMaxGb}
                onChange={(e) => set('noMaxGb', e.target.checked)}
                className='rounded border-beige accent-blush'
              />
              {t('admin.plans.field_no_max_gb')}
            </label>
          </div>
          <InputField
            type='number'
            min='0'
            value={form.maxGb}
            disabled={form.noMaxGb}
            onChange={(e) => set('maxGb', e.target.value)}
          />
        </div>

        {/* Live preview */}
        <CustomPlanPreview pricePerGb={pricePerGbNum} />

        {/* Active toggle */}
        <label className='flex items-center gap-2 text-xs text-warm-gray cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className='rounded border-beige accent-blush'
          />
          {t('admin.plans.field_active')}
        </label>

        {/* Actions */}
        <div className='flex items-center justify-end gap-2 pt-2'>
          <Button variant='ghost' size='sm' onClick={onClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            variant='primary'
            size='sm'
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------

interface PlanRowProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
}

function PlanRow({ plan, onEdit }: PlanRowProps) {
  const { t } = useI18n();

  const storageLabel = plan.storageBytes === null
    ? t('admin.plans.unlimited')
    : `${(plan.storageBytes / BYTES_PER_GB).toFixed(0)} GB`;

  const pricePerGbLabel = plan.pricePerGbIls != null
    ? `₪${plan.pricePerGbIls}`
    : t('admin.plans.na');

  return (
    <tr
      onClick={() => onEdit(plan)}
      className='border-b border-beige last:border-0 hover:bg-ivory/70 cursor-pointer group transition-colors'
    >
      <td className='px-4 py-3 text-xs font-mono text-warm-gray'>{plan.slug}</td>
      <td className='px-4 py-3 text-sm font-medium text-charcoal'>{plan.name}</td>
      <td className='px-4 py-3 text-sm text-warm-gray'>{storageLabel}</td>
      <td className='px-4 py-3 text-sm text-warm-gray'>
        {plan.priceMonthlyIls > 0 ? `₪${plan.priceMonthlyIls}` : t('admin.billing.free')}
      </td>
      <td className='px-4 py-3 text-sm text-warm-gray'>
        {plan.priceAnnualIls > 0 ? `₪${plan.priceAnnualIls}` : t('admin.plans.na')}
      </td>
      <td className='px-4 py-3 text-sm text-warm-gray'>{pricePerGbLabel}</td>
      <td className='px-4 py-3'>
        {plan.isActive ? (
          <Check size={14} className='text-green-500' />
        ) : (
          <X size={14} className='text-warm-gray' />
        )}
      </td>
      <td className='px-4 py-3'>
        <Pencil
          size={14}
          className='text-warm-gray opacity-0 group-hover:opacity-100 transition-opacity'
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const PlansPage = () => {
  const { t } = useI18n();
  const { data: plans = [], isLoading, isError } = useAdminPlans();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (isError) toast.error(t('admin.plans.load_failed'));
  }, [isError, t]);

  const thClass = 'px-4 py-3 text-left text-xs font-medium text-warm-gray uppercase tracking-wide whitespace-nowrap';

  return (
    <AdminLayout title={t('admin.plans.title')}>
      <div className='max-w-5xl mx-auto pb-10 pt-2 space-y-4'>

        {isLoading ? (
          <PlansPageSkeleton />
        ) : (
          <div className='rounded-2xl border border-beige bg-white overflow-hidden'>
            {plans.length === 0 ? (
              <p className='text-sm text-warm-gray p-6 text-center'>{t('admin.plans.click_to_edit')}</p>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead className='bg-ivory border-b border-beige'>
                    <tr>
                      <th className={thClass}>{t('admin.plans.col_slug')}</th>
                      <th className={thClass}>{t('admin.plans.col_name')}</th>
                      <th className={thClass}>{t('admin.plans.col_storage')}</th>
                      <th className={thClass}>{t('admin.plans.col_price_monthly')}</th>
                      <th className={thClass}>{t('admin.plans.col_price_annual')}</th>
                      <th className={thClass}>{t('admin.plans.col_price_per_gb')}</th>
                      <th className={thClass}>{t('admin.plans.col_active')}</th>
                      <th className='px-4 py-3 w-10' />
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <PlanRow key={plan.id} plan={plan} onEdit={setEditingPlan} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Edit modals */}
        {editingPlan && isCustomPlan(editingPlan.slug) && (
          <CustomPlanModal plan={editingPlan} onClose={() => setEditingPlan(null)} />
        )}
        {editingPlan && !isCustomPlan(editingPlan.slug) && (
          <FixedPlanModal plan={editingPlan} onClose={() => setEditingPlan(null)} />
        )}
      </div>
    </AdminLayout>
  );
};
