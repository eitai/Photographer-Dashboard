import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import axios from 'axios';
import api from '@/lib/api';
import JSZip from 'jszip';
import * as clientService from '@/services/clientService';
import * as galleryService from '@/services/galleryService';
import { ArrowLeft } from 'lucide-react';
import { ClientInfoCard } from '@/components/admin/ClientInfoCard';
import { GalleriesSection } from '@/components/admin/GalleriesSection';
import { SubmissionsSection } from '@/components/admin/SubmissionsSection';
import { ConfirmationModals } from '@/components/admin/ConfirmationModals';
import { ProductOrdersSection } from '@/components/admin/ProductOrdersSection';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const AdminClientDetail = () => {
  const { id } = useParams();
  const { t } = useI18n();
  const [client, setClient] = useState<any>(null);
  const [galleries, setGalleries] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [creatingDeliveryFor, setCreatingDeliveryFor] = useState<string | null>(null);
  const [deliveryHeaderMessage, setDeliveryHeaderMessage] = useState('');
  const [showDeliveryFormFor, setShowDeliveryFormFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, any[]>>({});
  const [downloading, setDownloading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);
  const [markingInEditingId, setMarkingInEditingId] = useState<string | null>(null);
  const [deleteImageTarget, setDeleteImageTarget] = useState<{ galleryId: string; submissionId: string; imageId: string } | null>(
    null,
  );
  const [deletingImage, setDeletingImage] = useState(false);
  const [deleteSubTarget, setDeleteSubTarget] = useState<{ galleryId: string; submissionId: string } | null>(null);
  const [deletingSubmission, setDeletingSubmission] = useState(false);
  const [deleteGalleryTarget, setDeleteGalleryTarget] = useState<string | null>(null);
  const [deletingGallery, setDeletingGallery] = useState(false);

  const loadSubmissions = async (galleryList: any[]) => {
    const submitted = galleryList.filter((g) => g.status === 'selection_submitted');
    const results: Record<string, any[]> = {};
    await Promise.all(
      submitted.map(async (g) => {
        results[g._id] = await galleryService.fetchSubmissions(g._id);
      }),
    );
    setSubmissions(results);
  };

  const loadGalleries = async () => {
    try {
      const data = await galleryService.fetchGalleries(id!);
      setGalleries(data);
      loadSubmissions(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const loadClient = async () => {
      try {
        const data = await clientService.getClient(id!);
        setClient(data);
        setForm(data);
      } catch {
        /* ignore */
      }
    };
    loadClient();
    loadGalleries();
  }, [id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const updated = await clientService.updateClient(id!, form);
    setClient(updated);
    setSaving(false);
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
    setCreatingDeliveryFor(originalGalleryId);
    const original = galleries.find((g) => g._id === originalGalleryId);
    const deliveryName = original ? `${original.name} — ${t('admin.client.delivery_suffix')}` : undefined;
    await galleryService.createDelivery(originalGalleryId, { headerMessage: deliveryHeaderMessage, name: deliveryName });
    setCreatingDeliveryFor(null);
    setShowDeliveryFormFor(null);
    setDeliveryHeaderMessage('');
    loadGalleries();
  };

  const resendEmail = async (galleryId: string) => {
    setResendingId(galleryId);
    const data = await galleryService.resendGalleryEmail(galleryId);
    if (data.lastEmailSentAt) {
      setGalleries((prev) => prev.map((g) => (g._id === galleryId ? { ...g, lastEmailSentAt: data.lastEmailSentAt } : g)));
    }
    setResendingId(null);
    setResentId(galleryId);
    setTimeout(() => setResentId(null), 2500);
  };

  const deleteSubmission = async () => {
    if (!deleteSubTarget) return;
    setDeletingSubmission(true);
    await galleryService.removeSubmission(deleteSubTarget.galleryId, deleteSubTarget.submissionId);
    setDeletingSubmission(false);
    setDeleteSubTarget(null);
    loadGalleries();
  };

  const deleteGallery = async () => {
    if (!deleteGalleryTarget) return;
    setDeletingGallery(true);
    await galleryService.removeGallery(deleteGalleryTarget);
    setDeletingGallery(false);
    setDeleteGalleryTarget(null);
    loadGalleries();
  };

  const deleteSubmissionImage = async () => {
    if (!deleteImageTarget) return;
    setDeletingImage(true);
    const { galleryId, submissionId, imageId } = deleteImageTarget;
    await galleryService.removeSubmissionImage(galleryId, submissionId, imageId);
    setDeletingImage(false);
    setDeleteImageTarget(null);
    loadGalleries();
  };

  const markInEditing = async (galleryId: string) => {
    setMarkingInEditingId(galleryId);
    try {
      await api.put(`/galleries/${galleryId}`, { status: 'in_editing' });
      loadGalleries();
    } catch {
      /* ignore */
    } finally {
      setMarkingInEditingId(null);
    }
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

  if (!client)
    return (
      <AdminLayout title={t('admin.common.loading')}>
        <p className='text-warm-gray text-sm'>{t('admin.common.loading')}</p>
      </AdminLayout>
    );

  return (
    <AdminLayout>
      <Link to='/admin/clients' className='flex items-center gap-1 text-sm text-warm-gray hover:text-charcoal mb-6'>
        <ArrowLeft size={14} /> {t('admin.common.back_clients')}
      </Link>
      <div className='space-y-6'>
        <ClientInfoCard
          client={client}
          editing={editing}
          setEditing={setEditing}
          form={form}
          setForm={setForm}
          saving={saving}
          save={save}
          t={t}
        />
        <GalleriesSection
          galleries={galleries}
          client={client}
          onCreated={loadGalleries}
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
          resendEmail={resendEmail}
          setDeleteGalleryTarget={setDeleteGalleryTarget}
          setShowDeliveryFormFor={setShowDeliveryFormFor}
          setDeliveryHeaderMessage={setDeliveryHeaderMessage}
          createDeliveryGallery={createDeliveryGallery}
        />
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
        <ProductOrdersSection
          clientId={id!}
          clientName={client.name}
          galleries={galleries}
        />
      </div>
      <ConfirmationModals
        deleteSubTarget={deleteSubTarget}
        deletingSubmission={deletingSubmission}
        deleteSubmission={deleteSubmission}
        setDeleteSubTarget={setDeleteSubTarget}
        deleteGalleryTarget={deleteGalleryTarget}
        deletingGallery={deletingGallery}
        deleteGallery={deleteGallery}
        setDeleteGalleryTarget={setDeleteGalleryTarget}
        deleteImageTarget={deleteImageTarget}
        deletingImage={deletingImage}
        deleteSubmissionImage={deleteSubmissionImage}
        setDeleteImageTarget={setDeleteImageTarget}
        t={t}
      />
    </AdminLayout>
  );
};
