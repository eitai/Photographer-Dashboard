import { useState } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { overrideAdminSubscription } from '@/lib/api';
import { queryKeys } from '@/hooks/useQueries';
import type { AdminRecord } from '@/types/admin';

interface Plan {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  customMinGb?: number;
  customMaxGb?: number;
}

interface Subscription {
  plan?: Plan | null;
  subscription?: { billingInterval?: string; customStorageGb?: number } | null;
}

interface Props {
  admin: AdminRecord | undefined;
  isOpen: boolean;
  onClose: () => void;
  allPlans: Plan[];
  currentSub: Subscription | undefined;
}

const labelClass = 'block text-xs text-warm-gray mb-1';

export const ChangePlanModal = ({ admin, isOpen, onClose, allPlans, currentSub }: Props) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const defaultPlan = currentSub?.plan ?? allPlans.find((p) => p.slug === 'free');
  const [planId, setPlanId] = useState(defaultPlan?.id ?? allPlans[0]?.id ?? '');
  const [interval, setInterval] = useState<'monthly' | 'annual'>(
    (currentSub?.subscription?.billingInterval as 'monthly' | 'annual') ?? 'monthly'
  );
  const [customGb, setCustomGb] = useState(currentSub?.subscription?.customStorageGb ?? 10);
  const [saving, setSaving] = useState(false);

  const selectedPlan = allPlans.find((p) => p.id === planId);

  const handleSave = async () => {
    if (!admin || !planId) return;
    setSaving(true);
    try {
      await overrideAdminSubscription(admin.id, {
        planId,
        billingInterval: selectedPlan?.slug === 'free' ? undefined : interval,
        ...(selectedPlan?.slug === 'custom' ? { customStorageGb: customGb } : {}),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSubscriptions });
      toast.success('Plan updated');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  if (!admin) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className='text-base font-semibold text-charcoal mb-1'>Change plan</h3>
      <p className='text-xs text-warm-gray mb-5'>{admin.name}</p>

      <div className='space-y-4'>
        <div>
          <label className={labelClass}>Plan</label>
          <SelectField value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {allPlans.filter((p) => p.isActive).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </SelectField>
        </div>

        {selectedPlan && selectedPlan.slug !== 'free' && (
          <div>
            <label className={labelClass}>Billing interval</label>
            <div className='flex gap-2'>
              {(['monthly', 'annual'] as const).map((iv) => (
                <button
                  key={iv}
                  type='button'
                  onClick={() => setInterval(iv)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    interval === iv ? 'bg-charcoal text-white border-charcoal' : 'border-beige text-warm-gray hover:bg-ivory'
                  }`}
                >
                  {iv.charAt(0).toUpperCase() + iv.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPlan?.slug === 'custom' && (
          <div>
            <label className={labelClass}>Storage: {customGb} GB</label>
            <input
              type='range'
              min={selectedPlan.customMinGb ?? 1}
              max={selectedPlan.customMaxGb ?? 1000}
              value={customGb}
              onChange={(e) => setCustomGb(Number(e.target.value))}
              className='w-full accent-blush'
            />
          </div>
        )}
      </div>

      <div className='flex gap-3 mt-6'>
        <Button variant='primary' size='sm' onClick={handleSave} disabled={saving} className='flex-1'>
          <Check size={13} />
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant='ghost' size='sm' onClick={onClose} className='flex-1'>
          Cancel
        </Button>
      </div>
    </Modal>
  );
};
