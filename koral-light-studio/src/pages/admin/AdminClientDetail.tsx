import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import axios from 'axios';
import { toast } from 'sonner';
import JSZip from 'jszip';
import * as galleryService from '@/services/galleryService';
import { ArrowLeft } from 'lucide-react';
import { ClientInfoCard } from '@/components/admin/ClientInfoCard';
import { GalleriesSection } from '@/components/admin/GalleriesSection';
import { SubmissionsSection } from '@/components/admin/SubmissionsSection';
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
  useDeleteGallery,
  useDeleteSubmission,
  useDeleteSubmissionImage,
  useUpdateGallery,
  queryKeys,
} from '@/hooks/useQueries';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  const deleteGalleryMutation = useDeleteGallery(id!);
  const deleteSubmissionMutation = useDeleteSubmission(id!);
  const deleteSubmissionImageMutation = useDeleteSubmissionImage(id!);
  const updateGallery = useUpdateGallery(queryKeys.galleriesByClient(id!));

  // ---------------------------------------------------------------------------
  // Submissions — prefetch for all selection_submitted galleries
  // ---------------------------------------------------------------------------
  const submittedGalleries = galleries.filter((g) => g.status === 'selection_submitted');

  useEffect(() => {
    const ids = submittedGalleries.map((g) => g._id).join(',');
    if (!ids) return;
    submittedGalleries.forEach((g) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.submissions(g._id),
        queryFn: () => galleryService.fetchSubmissions(g._id),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedGalleries.map((g) => g._id).join(',')]);

  const submissions = useMemo(() => {
    const result: Record<string, any[]> = {};
    submittedGalleries.forEach((g) => {
      const cached = queryClient.getQueryData<any[]>(queryKeys.submissions(g._id));
      if (cached) result[g._id] = cached;
    });
    return result;
  }, [galleries, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Pure UI state (not server data)
  // ---------------------------------------------------------------------------
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [deliveryHeaderMessage, setDeliveryHeaderMessage] = useState('');
  const [showDeliveryFormFor, setShowDeliveryFormFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [resentId, setResentId] = useState<string | null>(null);
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

  const downloadAsZip = async (submission: any) => {
    setDownloading(true);
    const zip = new JSZip();
    const folder = zip.folder('selected-images')!;
    await Promise.all(
      submission.selectedImageIds.map(async (img: any) => {
        const res = await axios.get(`${API_BASE}${img.path}`, { responseType: 'blob' });
        const ext = img.filename.includes('.') ? `.${img.filename.split('.').pop()}` : '';
        folder.file(`${img._id}${ext}`, res.data);
      }),
    );
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `selection-${submission._id}.zip`;
    a.click();
    setDownloading(false);
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

  const handleDeleteSubmissionImage = async () => {
    if (!deleteImageTarget) return;
    await deleteSubmissionImageMutation.mutateAsync(deleteImageTarget);
    setDeleteImageTarget(null);
  };

  const markInEditing = (galleryId: string) => {
    updateGallery.mutate(
      { id: galleryId, data: { status: 'in_editing' } },
      { onError: () => toast.error(t('admin.selections.mark_failed')) },
    );
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
  const markingInEditingId = updateGallery.isPending ? updateGallery.variables?.id ?? null : null;
  const deletingImage = deleteSubmissionImageMutation.isPending;
  const deletingSubmission = deleteSubmissionMutation.isPending;
  const deletingGallery = deleteGalleryMutation.isPending;

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
            t={t}
          />
        </ErrorBoundary>
        <ErrorBoundary label='Galleries'>
          <GalleriesSection
            galleries={galleries}
            client={client}
            onCreated={() => queryClient.invalidateQueries({ queryKey: queryKeys.galleriesByClient(id!) })}
            t={t}
            copiedId={copiedId}
            resendingId={resendingId}
            resentId={resentId}
            showDeliveryFormFor={showDeliveryFormFor}
            deliveryHeaderMessage={deliveryHeaderMessage}
            creatingDeliveryFor={creatingDeliveryFor}
            markingInEditingId={markingInEditingId}
            onMarkInEditing={markInEditing}
            copyLink={copyLink}
            whatsAppLink={whatsAppLink}
            resendEmail={handleResendEmail}
            setDeleteGalleryTarget={setDeleteGalleryTarget}
            setShowDeliveryFormFor={setShowDeliveryFormFor}
            setDeliveryHeaderMessage={setDeliveryHeaderMessage}
            createDeliveryGallery={createDeliveryGallery}
          />
        </ErrorBoundary>
        <ErrorBoundary label='Submissions'>
          <SubmissionsSection
            galleries={galleries}
            submissions={submissions}
            downloading={downloading}
            API_BASE={API_BASE}
            t={t}
            downloadAsZip={downloadAsZip}
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
        t={t}
      />
    </AdminLayout>
  );
};
