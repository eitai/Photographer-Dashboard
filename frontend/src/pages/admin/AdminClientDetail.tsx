import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { ClientInfoCard } from '@/components/admin/ClientInfoCard';
import { GalleriesSection } from '@/components/admin/GalleriesSection';
import { ConfirmationModals } from '@/components/admin/ConfirmationModals';
import { ProductOrdersSection } from '@/components/admin/ProductOrdersSection';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useQueryClient } from '@tanstack/react-query';
import {
  useClient,
  useGalleriesByClient,
  useUpdateClient,
  useCreateDelivery,
  useResendGalleryEmail,
  useSendGallerySms,
  useDeleteGallery,
  useReactivateGallery,
  useDeleteSubmission,
  useDeleteSubmissionImage,
  queryKeys,
} from '@/hooks/useQueries';
import type { Client } from '@/types/admin';

export const AdminClientDetail = () => {
  const { id } = useParams();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Server state — React Query
  // ---------------------------------------------------------------------------
  const { data: client, isLoading: clientLoading } = useClient(id!);
  const { data: galleries = [] } = useGalleriesByClient(id!);

  // Mutations
  const updateClient = useUpdateClient(id!);
  const createDelivery = useCreateDelivery(id!);
  const resendEmail = useResendGalleryEmail(id!);
  const sendSms = useSendGallerySms(id!);
  const deleteGalleryMutation = useDeleteGallery(id!);
  const reactivateGalleryMutation = useReactivateGallery(id!);
  const deleteSubmissionMutation = useDeleteSubmission(id!);
  const deleteSubmissionImageMutation = useDeleteSubmissionImage(id!);

  // ---------------------------------------------------------------------------
  // Pure UI state (not server data)
  // ---------------------------------------------------------------------------
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [deliveryHeaderMessage, setDeliveryHeaderMessage] = useState('');
  const [showDeliveryFormFor, setShowDeliveryFormFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);
  const [sentSmsId, setSentSmsId] = useState<string | null>(null);
  const [deleteImageTarget, setDeleteImageTarget] = useState<{ galleryId: string; submissionId: string; imageId: string } | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<{ galleryId: string; submissionId: string } | null>(null);
  const [deleteGalleryTarget, setDeleteGalleryTarget] = useState<string | null>(null);

  // Sync form when client data first arrives
  useEffect(() => {
    if (client) setForm(client);
  }, [client]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateClient.mutateAsync(form);
    setEditing(false);
  };

  const createDeliveryGallery = async (originalGalleryId: string) => {
    const original = galleries.find((g) => g._id === originalGalleryId);
    const deliveryName = original ? `${original.name} — ${t('admin.client.delivery_suffix')}` : undefined;
    await createDelivery.mutateAsync({
      galleryId: originalGalleryId,
      data: { headerMessage: deliveryHeaderMessage, name: deliveryName },
    });
    setShowDeliveryFormFor(null);
    setDeliveryHeaderMessage('');
  };

  const handleResendEmail = async (galleryId: string) => {
    await resendEmail.mutateAsync(galleryId);
    setResentId(galleryId);
    setTimeout(() => setResentId(null), 2500);
  };

  const handleSendSms = async (galleryId: string) => {
    try {
      await sendSms.mutateAsync(galleryId);
      setSentSmsId(galleryId);
      setTimeout(() => setSentSmsId(null), 2500);
      toast.success(t('admin.galleries.sms_sent_success').replace('{name}', client?.name ?? ''));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t('admin.galleries.sms_sent_error').replace('{name}', client?.name ?? ''));
    }
  };

  const handleDeleteSubmission = async () => {
    if (!deleteSubTarget) return;
    await deleteSubmissionMutation.mutateAsync(deleteSubTarget);
    setDeleteSubTarget(null);
  };

  const handleDeleteGallery = async () => {
    if (!deleteGalleryTarget) return;
    await deleteGalleryMutation.mutateAsync(deleteGalleryTarget);
    setDeleteGalleryTarget(null);
  };

  const handleReactivateGallery = async (galleryId: string) => {
    await reactivateGalleryMutation.mutateAsync(galleryId);
  };

  const handleDeleteSubmissionImage = async () => {
    if (!deleteImageTarget) return;
    await deleteSubmissionImageMutation.mutateAsync(deleteImageTarget);
    setDeleteImageTarget(null);
  };

  const copyLink = (token: string, galleryId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/gallery/${token}`);
    setCopiedId(galleryId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const whatsAppLink = (token: string) => {
    const url = `${window.location.origin}/gallery/${token}`;
    const message = t('admin.galleries.whatsapp_msg').replace('{name}', client.name).replace('{url}', url);
    const phone = (client.phone || '').replace(/[\s\-().+]/g, '').replace(/^0/, '972');
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // ---------------------------------------------------------------------------
  // Loading gate
  // ---------------------------------------------------------------------------
  if (clientLoading || !client)
    return (
      <AdminLayout title={t('admin.common.loading')}>
        <p className='text-warm-gray text-sm'>{t('admin.common.loading')}</p>
      </AdminLayout>
    );

  // Derive per-mutation pending IDs
  const creatingDeliveryFor = createDelivery.isPending ? createDelivery.variables?.galleryId ?? null : null;
  const resendingId = resendEmail.isPending ? resendEmail.variables ?? null : null;
  const sendingSmId = sendSms.isPending ? sendSms.variables ?? null : null;
  const deletingImage = deleteSubmissionImageMutation.isPending;
  const deletingSubmission = deleteSubmissionMutation.isPending;
  const deletingGallery = deleteGalleryMutation.isPending;
  const reactivatingId = reactivateGalleryMutation.isPending ? reactivateGalleryMutation.variables ?? null : null;

  return (
    <AdminLayout>
      <Link to='/admin/clients' className='flex items-center gap-1 text-sm text-warm-gray hover:text-charcoal mb-6'>
        <ArrowLeft size={14} /> {t('admin.common.back_clients')}
      </Link>
      <div className='space-y-6'>
        <ErrorBoundary label='Client Info'>
          <ClientInfoCard
            client={client}
            editing={editing}
            setEditing={setEditing}
            form={form}
            setForm={setForm}
            saving={updateClient.isPending}
            save={save}
          />
        </ErrorBoundary>
        <ErrorBoundary label='Galleries'>
          <GalleriesSection
            galleries={galleries}
            client={client}
            onCreated={() => queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(id!) })}
            copiedId={copiedId}
            resendingId={resendingId}
            resentId={resentId}
            sendingSmId={sendingSmId}
            sentSmsId={sentSmsId}
            showDeliveryFormFor={showDeliveryFormFor}
            deliveryHeaderMessage={deliveryHeaderMessage}
            creatingDeliveryFor={creatingDeliveryFor}
            copyLink={copyLink}
            whatsAppLink={whatsAppLink}
            resendEmail={handleResendEmail}
            sendSms={handleSendSms}
            setDeleteGalleryTarget={setDeleteGalleryTarget}
            setShowDeliveryFormFor={setShowDeliveryFormFor}
            setDeliveryHeaderMessage={setDeliveryHeaderMessage}
            createDeliveryGallery={createDeliveryGallery}
            reactivateGallery={handleReactivateGallery}
            reactivatingId={reactivatingId}
            setDeleteSubTarget={setDeleteSubTarget}
            setDeleteImageTarget={setDeleteImageTarget}
          />
        </ErrorBoundary>
        <ErrorBoundary label='Product Orders'>
          <ProductOrdersSection
            clientId={id!}
            clientName={client.name}
            galleries={galleries}
          />
        </ErrorBoundary>
      </div>
      <ConfirmationModals
        deleteSubTarget={deleteSubTarget}
        deletingSubmission={deletingSubmission}
        deleteSubmission={handleDeleteSubmission}
        setDeleteSubTarget={setDeleteSubTarget}
        deleteGalleryTarget={deleteGalleryTarget}
        deletingGallery={deletingGallery}
        deleteGallery={handleDeleteGallery}
        setDeleteGalleryTarget={setDeleteGalleryTarget}
        deleteImageTarget={deleteImageTarget}
        deletingImage={deletingImage}
        deleteSubmissionImage={handleDeleteSubmissionImage}
        setDeleteImageTarget={setDeleteImageTarget}
      />
    </AdminLayout>
  );
};
