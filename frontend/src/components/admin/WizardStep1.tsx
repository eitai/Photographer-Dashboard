import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { InputField, TextareaField } from '@/components/admin/InputField';
import { SessionTypeCombobox } from '@/components/admin/SessionTypeCombobox';
import { Button } from '@/components/admin/Button';

const clientSchema = z.object({
  name: z.string().min(1),
  phone: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  email: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  sessionType: z.string().optional(),
  notes: z.string().optional(),
  eventDate: z.string().optional(),
  addressStreet: z.string().optional(),
  addressApartment: z.string().optional(),
  addressCity: z.string().optional(),
  addressZip: z.string().optional(),
  addressCountry: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface WizardStep1Props {
  form: UseFormReturn<ClientFormValues>;
  onNext: () => void;
  onCancel: () => void;
  disabled?: boolean;
  /** Overrides the default "Next" label (e.g. "Finish & Create" when this is the only step) */
  nextLabel?: string;
}

export const WizardStep1 = ({ form, onNext, onCancel, disabled = false, nextLabel }: WizardStep1Props) => {
  const { t } = useI18n();
  const { register, formState: { errors } } = form;
  const [addressOpen, setAddressOpen] = useState(false);

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.name')}</label>
          <InputField {...register('name')} disabled={disabled} />
          {errors.name && <p className='text-xs text-rose-500 mt-1'>{errors.name.message}</p>}
        </div>

        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.phone')}</label>
          <InputField type='tel' {...register('phone')} disabled={disabled} />
          {errors.phone && <p className='text-xs text-rose-500 mt-1'>{errors.phone.message}</p>}
        </div>

        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.email')}</label>
          <InputField type='email' {...register('email')} disabled={disabled} />
          {errors.email && <p className='text-xs text-rose-500 mt-1'>{errors.email.message}</p>}
        </div>

        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.session_type')}</label>
          <SessionTypeCombobox
            value={form.watch('sessionType') ?? ''}
            onChange={(val) => form.setValue('sessionType', val)}
          />
        </div>

        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.event_date')}</label>
          <InputField type='date' {...register('eventDate')} disabled={disabled} />
        </div>

        <div className='col-span-full'>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.notes')}</label>
          <TextareaField {...register('notes')} rows={2} disabled={disabled} />
        </div>
      </div>

      {/* ── Shipping address (collapsible, optional) ──────────────────────── */}
      <div className='border border-beige rounded-lg overflow-hidden'>
        <button
          type='button'
          onClick={() => setAddressOpen((o) => !o)}
          className='w-full flex items-center justify-between px-3 py-2.5 text-xs text-warm-gray hover:bg-ivory/60 transition-colors'
        >
          <span className='flex items-center gap-1.5'>
            <MapPin size={11} />
            {t('admin.client.address_optional')}
          </span>
          {addressOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {addressOpen && (
          <div className='grid grid-cols-2 gap-3 px-3 pb-3 pt-1 border-t border-beige'>
            <div className='col-span-full'>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_street')}</label>
              <InputField {...register('addressStreet')} disabled={disabled} />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_apartment')}</label>
              <InputField {...register('addressApartment')} disabled={disabled} />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_city')}</label>
              <InputField {...register('addressCity')} disabled={disabled} />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_zip')}</label>
              <InputField {...register('addressZip')} disabled={disabled} />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_country')}</label>
              <InputField {...register('addressCountry')} placeholder='ישראל' disabled={disabled} />
            </div>
          </div>
        )}
      </div>

      <div className='flex gap-2 pt-1'>
        <Button type='button' variant='primary' size='lg' onClick={onNext} disabled={disabled}>
          {nextLabel ?? t('admin.clients.wizard.next')}
        </Button>
        <Button type='button' variant='ghost' size='lg' onClick={onCancel} disabled={disabled}>
          {t('admin.common.cancel')}
        </Button>
      </div>
    </div>
  );
};
