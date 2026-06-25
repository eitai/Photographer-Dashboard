import { useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useCreateClient } from '@/hooks/useQueries';
import { Modal } from '@/components/ui/Modal';
import { WizardStep1 } from '@/components/admin/WizardStep1';

interface CreateClientWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateClientWizard = ({ isOpen, onClose }: CreateClientWizardProps) => {
  const { t } = useI18n();
  const createClient = useCreateClient();
  useQueryClient();

  const [saving, setSaving] = useState(false);
  // Synchronous double-submit guard (double-click outruns the React re-render)
  const savingRef = useRef(false);
  const [submitError, setSubmitError] = useState('');

  const clientSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('admin.clients.name_required')),
        phone: z.preprocess(
          (val) => (val === '' ? undefined : val),
          z
            .string()
            .regex(/^[0-9+\-\s().]{7,20}$/, t('admin.clients.invalid_phone'))
            .optional(),
        ),
        email: z.preprocess(
          (val) => (val === '' ? undefined : val),
          z.string().email(t('admin.clients.invalid_email')).optional(),
        ),
        sessionType: z.string().optional(),
        notes: z.string().optional(),
        eventDate: z.string().optional(),
        addressStreet: z.string().optional(),
        addressApartment: z.string().optional(),
        addressCity: z.string().optional(),
        addressZip: z.string().optional(),
        addressCountry: z.string().optional(),
      }),
    [t],
  );

  type ClientFormValues = z.infer<typeof clientSchema>;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '', phone: '', email: '', sessionType: '', notes: '', eventDate: '',
      addressStreet: '', addressApartment: '', addressCity: '', addressZip: '', addressCountry: '',
    },
  });

  const closeAndReset = () => {
    form.reset();
    setSaving(false);
    setSubmitError('');
    onClose();
  };

  const VALID_SESSION_TYPES = ['family', 'maternity', 'newborn', 'branding', 'landscape'];

  const handleFinish = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSubmitError('');
    try {
      const { name, phone, email, sessionType, notes, eventDate, addressStreet, addressApartment, addressCity, addressZip, addressCountry } = form.getValues();
      await createClient.mutateAsync({
        name,
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        ...(sessionType && VALID_SESSION_TYPES.includes(sessionType) ? { sessionType: sessionType as 'family' | 'maternity' | 'newborn' | 'branding' | 'landscape' } : {}),
        ...(notes ? { notes } : {}),
        ...(eventDate ? { eventDate } : {}),
        ...(addressStreet ? { addressStreet } : {}),
        ...(addressApartment ? { addressApartment } : {}),
        ...(addressCity ? { addressCity } : {}),
        ...(addressZip ? { addressZip } : {}),
        ...(addressCountry ? { addressCountry } : {}),
        status: 'gallery_sent',
      });
      closeAndReset();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(msg || t('admin.clients.wizard.create_error'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? undefined : closeAndReset} maxWidth='max-w-lg'>
      <div className='space-y-4'>
        <h3 className='text-base font-semibold text-charcoal'>{t('admin.clients.wizard.title')}</h3>

        <WizardStep1
          form={form}
          onNext={form.handleSubmit(handleFinish)}
          onCancel={closeAndReset}
          disabled={saving}
          nextLabel={saving ? t('admin.common.saving') : t('admin.clients.wizard.finish')}
        />

        {submitError && <p className='text-sm text-red-500'>{submitError}</p>}
      </div>
    </Modal>
  );
};
