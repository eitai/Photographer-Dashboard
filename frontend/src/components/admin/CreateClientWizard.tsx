import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { useAdminProducts, useCreateClient } from '@/hooks/useQueries';
import { createProductOrder } from '@/services/productOrderService';
import { Modal } from '@/components/ui/Modal';
import { WizardStepIndicator } from '@/components/admin/WizardStepIndicator';
import { WizardStep1 } from '@/components/admin/WizardStep1';
import { WizardStep2 } from '@/components/admin/WizardStep2';
import type { ProductRowState } from '@/components/admin/WizardProductRow';

interface CreateClientWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateClientWizard = ({ isOpen, onClose }: CreateClientWizardProps) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data: catalogProducts = [], isLoading: catalogLoading } = useAdminProducts();
  const createClient = useCreateClient();
  useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [productRows, setProductRows] = useState<ProductRowState[]>([]);
  const [saving, setSaving] = useState(false);
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
      }),
    [t],
  );

  type ClientFormValues = z.infer<typeof clientSchema>;

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', phone: '', email: '', sessionType: '', notes: '' },
  });

  const closeAndReset = () => {
    form.reset();
    setStep(1);
    setProductRows([]);
    setSaving(false);
    setSubmitError('');
    onClose();
  };

  const handleNext = form.handleSubmit(() => setStep(2));

  const VALID_SESSION_TYPES = ['family', 'maternity', 'newborn', 'branding', 'landscape'];

  const handleFinish = async () => {
    setSaving(true);
    setSubmitError('');
    try {
      const { name, phone, email, sessionType, notes } = form.getValues();
      const newClient = await createClient.mutateAsync({
        name,
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        ...(sessionType && VALID_SESSION_TYPES.includes(sessionType) ? { sessionType: sessionType as 'family' | 'maternity' | 'newborn' | 'branding' | 'landscape' } : {}),
        ...(notes ? { notes } : {}),
        status: 'gallery_sent',
      });
      if (productRows.length > 0) {
        const results = await Promise.allSettled(
          productRows.map((row) =>
            createProductOrder({
              clientId: newClient._id,
              name: row.name,
              type: row.type,
              maxPhotos: row.maxPhotos,
              allowedGalleryIds: [],
            }),
          ),
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          toast({
            title: t('admin.clients.wizard.products_partial_fail'),
            description: (
              <Link to={`/admin/clients/${newClient._id}`} className='underline'>
                {t('admin.clients.wizard.view_client')}
              </Link>
            ),
          });
        }
      }
      closeAndReset();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(msg || t('admin.clients.wizard.create_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? undefined : closeAndReset} maxWidth='max-w-lg'>
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-base font-semibold text-charcoal'>{t('admin.clients.wizard.title')}</h3>
          <WizardStepIndicator step={step} />
        </div>

        {step === 1 && (
          <WizardStep1
            form={form}
            onNext={handleNext}
            onCancel={closeAndReset}
            disabled={saving}
          />
        )}

        {step === 2 && (
          <WizardStep2
            productRows={productRows}
            onRowsChange={setProductRows}
            catalogProducts={catalogProducts}
            catalogLoading={catalogLoading}
            onFinish={handleFinish}
            onBack={() => { setStep(1); setSubmitError(''); }}
            saving={saving}
            error={submitError}
          />
        )}
      </div>
    </Modal>
  );
};
