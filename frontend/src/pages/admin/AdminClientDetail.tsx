import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ClientInfoCard } from '@/components/admin/ClientInfoCard';
import { GalleriesSection } from '@/components/admin/GalleriesSection';
import { ConfirmationModals } from '@/components/admin/ConfirmationModals';
import { ClientOrdersSection } from '@/components/admin/ClientOrdersSection';
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);
  const [sentSmsId, setSentSmsId] = useState<string | null>(null);
  const [deleteImageTarget, setDeleteImageTarget] = useState<{ galleryId: string; submissionId: string; imageId: string } | null>(
    null,
  );
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

  // Handlers passed to memoized GalleryCards — keep references stable so an
  // unrelated page re-render doesn't re-render every card. mutateAsync is
  // referentially stable in TanStack Query; the mutation result object is not.
  const { mutateAsync: createDeliveryAsync } = createDelivery;
  const { mutateAsync: resendEmailAsync } = resendEmail;
  const { mutateAsync: sendSmsAsync } = sendSms;
  const { mutateAsync: reactivateGalleryAsync } = reactivateGalleryMutation;

  const createDeliveryGallery = useCallback(
    async (originalGalleryId: string, headerMessage: string) => {
      const original = galleries.find((g) => g._id === originalGalleryId);
      const deliveryName = original ? `${original.name} — ${t('admin.client.delivery_suffix')}` : undefined;
      await createDeliveryAsync({
        galleryId: originalGalleryId,
        data: { headerMessage, name: deliveryName },
      });
    },
    [galleries, createDeliveryAsync, t],
  );

  const handleResendEmail = useCallback(
    async (galleryId: string) => {
      await resendEmailAsync(galleryId);
      setResentId(galleryId);
      setTimeout(() => setResentId(null), 2500);
    },
    [resendEmailAsync],
  );

  const handleSendSms = useCallback(
    async (galleryId: string) => {
      try {
        await sendSmsAsync(galleryId);
        setSentSmsId(galleryId);
        setTimeout(() => setSentSmsId(null), 2500);
        toast.success(t('admin.galleries.sms_sent_success').replace('{name}', client?.name ?? ''));
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || t('admin.galleries.sms_sent_error').replace('{name}', client?.name ?? ''));
      }
    },
    [sendSmsAsync, t, client?.name],
  );

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

  const handleReactivateGallery = useCallback(
    async (galleryId: string) => {
      await reactivateGalleryAsync(galleryId);
    },
    [reactivateGalleryAsync],
  );

  const handleDeleteSubmissionImage = async () => {
    if (!deleteImageTarget) return;
    await deleteSubmissionImageMutation.mutateAsync(deleteImageTarget);
    setDeleteImageTarget(null);
  };

  const copyLink = useCallback((token: string, galleryId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/gallery/${token}`);
    setCopiedId(galleryId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const whatsAppLink = useCallback(
    (token: string) => {
      const url = `${window.location.origin}/gallery/${token}`;
      const message = t('admin.galleries.whatsapp_msg').replace('{name}', client?.name ?? '').replace('{url}', url);
      const phone = (client?.phone || '').replace(/[\s\-().+]/g, '').replace(/^0/, '972');
      return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    },
    [t, client?.name, client?.phone],
  );

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
  const creatingDeliveryFor = createDelivery.isPending ? (createDelivery.variables?.galleryId ?? null) : null;
  const resendingId = resendEmail.isPending ? (resendEmail.variables ?? null) : null;
  const sendingSmId = sendSms.isPending ? (sendSms.variables ?? null) : null;
  const deletingImage = deleteSubmissionImageMutation.isPending;
  const deletingSubmission = deleteSubmissionMutation.isPending;
  const deletingGallery = deleteGalleryMutation.isPending;
  const reactivatingId = reactivateGalleryMutation.isPending ? (reactivateGalleryMutation.variables ?? null) : null;

  return (
    <AdminLayout>
      <Link to='/admin/clients' className='flex items-center gap-1 text-sm text-warm-gray hover:text-charcoal mb-6'>
        <ArrowRight size={14} /> {t('admin.common.back_clients')}
      </Link>
      <div className='space-y-6'>
        {/* Top row: client info + product orders side by side */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch'>
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
          <ErrorBoundary label='Orders'>
            <ClientOrdersSection clientId={id!} clientName={client.name} galleries={galleries} clientEmail={client.email} />
          </ErrorBoundary>
        </div>
        {/* Galleries below */}
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
            creatingDeliveryFor={creatingDeliveryFor}
            copyLink={copyLink}
            whatsAppLink={whatsAppLink}
            resendEmail={handleResendEmail}
            sendSms={handleSendSms}
            setDeleteGalleryTarget={setDeleteGalleryTarget}
            createDeliveryGallery={createDeliveryGallery}
            reactivateGallery={handleReactivateGallery}
            reactivatingId={reactivatingId}
            setDeleteSubTarget={setDeleteSubTarget}
            setDeleteImageTarget={setDeleteImageTarget}
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
