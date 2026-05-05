import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Copy, Check, Mail, ExternalLink, Trash2, Settings, Images, MessageSquare, RotateCcw, Download, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Client } from '@/types/admin';
import type { GalleryData } from '@/types/gallery';
import { WhatsAppIcon } from '@/pages/admin/dashboard/WhatsAppIcon';
import { useGalleryPreviewImages, useSubmissions } from '@/hooks/useQueries';
import { getImageUrl } from '@/lib/api';
import { downloadZip } from '@/lib/downloadZip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SESSION_TYPE_KEYS } from '@/components/admin/SessionTypeCombobox';

const getGalleryDisplayName = (name: string, t: (key: string) => string) => {
  if (!SESSION_TYPE_KEYS.includes(name)) return name;
  const translated = t(`admin.session.${name}`);
  return translated.startsWith('admin.session.') ? name : translated;
};

function useExpiryBadge(expiresAt: string | null | undefined, t: (key: string) => string) {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffMs < 0) {
    return { label: t('admin.gallery.badge_expired'), className: 'bg-rose-100 text-rose-700 border-rose-200' };
  }
  if (diffDays === 0) {
    return { label: t('admin.gallery.badge_expires_today'), className: 'bg-orange-100 text-orange-700 border-orange-200' };
  }
  if (diffDays === 1) {
    return { label: t('admin.gallery.badge_expires_in_1_day'), className: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  if (diffDays <= 7) {
    return { label: t('admin.gallery.badge_expires_in_days').replace('{n}', String(diffDays)), className: 'bg-amber-50 text-amber-600 border-amber-200' };
  }
  return { label: t('admin.gallery.badge_expires_in_days').replace('{n}', String(diffDays)), className: 'bg-muted text-muted-foreground border-border' };
}

const Tip = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className='inline-flex'>{children}</span>
    </TooltipTrigger>
    <TooltipContent side='top'><p>{label}</p></TooltipContent>
  </Tooltip>
);

interface GalleryCardProps {
  g: GalleryData;
  client: Client;
  copiedId: string | null;
  resendingId: string | null;
  resentId: string | null;
  sendingSmId: string | null;
  sentSmsId: string | null;
  showDeliveryFormFor: string | null;
  deliveryHeaderMessage: string;
  creatingDeliveryFor: string | null;
  galleries: GalleryData[];
  delivery?: GalleryData;
  copyLink: (token: string, galleryId: string) => void;
  whatsAppLink: (token: string) => string;
  resendEmail: (galleryId: string) => void;
  sendSms: (galleryId: string) => void;
  setDeleteGalleryTarget: (id: string | null) => void;
  setShowDeliveryFormFor: (id: string | null) => void;
  setDeliveryHeaderMessage: (msg: string) => void;
  createDeliveryGallery: (originalGalleryId: string) => void;
  reactivateGallery: (galleryId: string) => void;
  reactivatingId: string | null;
  setDeleteSubTarget: (t: { galleryId: string; submissionId: string } | null) => void;
  setDeleteImageTarget: (t: { galleryId: string; submissionId: string; imageId: string } | null) => void;
}

export const GalleryCard = ({
  g,
  client,
  copiedId,
  resendingId,
  resentId,
  sendingSmId,
  sentSmsId,
  showDeliveryFormFor,
  deliveryHeaderMessage,
  creatingDeliveryFor,
  galleries,
  delivery,
  copyLink,
  whatsAppLink,
  resendEmail,
  sendSms,
  setDeleteGalleryTarget,
  setShowDeliveryFormFor,
  setDeliveryHeaderMessage,
  createDeliveryGallery,
  reactivateGallery,
  reactivatingId,
  setDeleteSubTarget,
}: GalleryCardProps) => {
  const { t } = useI18n();
  const hasDelivery = !!delivery || galleries.some((g2) => g2.deliveryOf === g._id);
  const { data: previewImages = [] } = useGalleryPreviewImages(g._id);
  const { data: submissions = [] } = useSubmissions(g._id);
  const expiryBadge = useExpiryBadge(g.expiresAt, t);
  const submission = submissions[0] ?? null;

  const [dlProgress, setDlProgress] = useState<{ done: number; total: number } | null>(null);

  const handleDownload = async () => {
    if (!submission) return;
    setDlProgress({ done: 0, total: submission.selectedImageIds.length });
    await downloadZip(submission.selectedImageIds, 'selected-images', `selection-${submission._id}`, (done, total) =>
      setDlProgress({ done, total }),
    );
    setDlProgress(null);
  };

  return (
    <div
      className={`rounded-xl bg-card shadow-sm flex flex-col overflow-hidden border transition-colors hover:bg-muted/20 ${
        g.isDelivery
          ? 'border-blush/40'
          : g.status === 'delivered'
          ? 'border-border'
          : submission
          ? 'border-amber-300'
          : 'border-border'
      }`}
    >
      {/* Clickable header — navigates into the gallery */}
      <Link to={`/admin/galleries/${g._id}`} className='flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors'>
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-charcoal truncate'>{getGalleryDisplayName(g.name, t)}</p>
          <div className='mt-1'>
            <StatusBadge status={g.status} />
          </div>
          {g.createdAt && (
            <p className='text-[10px] text-warm-gray mt-1'>
              {new Date(g.createdAt).toLocaleDateString()}
            </p>
          )}
          {g.lastEmailSentAt && (
            <p className='flex items-center gap-1 mt-1 text-[10px] text-warm-gray'>
              <Mail size={9} />
              {new Date(g.lastEmailSentAt).toLocaleDateString()}
            </p>
          )}
          {expiryBadge && (
            <span className={`inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${expiryBadge.className}`}>
              {expiryBadge.label}
            </span>
          )}
        </div>

        <div className='flex gap-1.5 overflow-hidden'>
          {previewImages.length > 0 ? (
            previewImages.slice(0, 5).map((img) => (
              <img
                key={img._id}
                src={getImageUrl(img.thumbnailPath || img.path)}
                alt=''
                className='w-16 h-16 rounded-lg object-cover border border-border shrink-0'
              />
            ))
          ) : (
            <div className='w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0'>
              <Images size={14} className='text-muted-foreground/40' />
            </div>
          )}
        </div>
      </Link>

      {/* Selected images strip */}
      {submission && submission.selectedImageIds.length > 0 && (
        <div className='mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300'>
          <span className='text-xs text-warm-gray flex-1'>
            {submission.selectedImageIds.length} {t('admin.submissions.selected_count')}
          </span>
          <Tip label={t('admin.submissions.download_zip')}>
            <button
              onClick={handleDownload}
              disabled={!!dlProgress}
              className='flex items-center gap-1 text-xs text-charcoal hover:text-blush transition-colors disabled:opacity-60'
            >
              {dlProgress ? (
                <>
                  <Loader2 size={12} className='animate-spin' />
                  {dlProgress.done}/{dlProgress.total}
                </>
              ) : (
                <>
                  <Download size={12} />
                  {t('admin.submissions.download_zip')}
                </>
              )}
            </button>
          </Tip>
          <Tip label={t('admin.submissions.delete')}>
            <button
              onClick={() => setDeleteSubTarget({ galleryId: g._id, submissionId: submission._id })}
              className='flex items-center gap-1 text-xs text-warm-gray hover:text-rose-500 transition-colors'
            >
              <Trash2 size={12} />
              {t('admin.submissions.delete')}
            </button>
          </Tip>
        </div>
      )}

      {/* Action bar */}
      <div className='flex items-center gap-1.5 px-4 pb-4'>
        <Tip label={t('admin.client.delete_gallery')}>
          <button
            onClick={() => setDeleteGalleryTarget(g._id)}
            className='p-2 rounded-lg border border-border bg-muted/30 text-warm-gray hover:text-rose-500 hover:bg-rose-50 transition-colors'
          >
            <Trash2 size={13} />
          </button>
        </Tip>
        <Tip label={copiedId === g._id ? t('admin.client.copied') : t('admin.client.copy_link')}>
          <button
            onClick={() => copyLink(g.token, g._id)}
            className='p-2 rounded-lg border border-border bg-muted/30 text-warm-gray hover:text-charcoal hover:bg-muted transition-colors'
          >
            {copiedId === g._id ? <Check size={13} className='text-green-500' /> : <Copy size={13} />}
          </button>
        </Tip>
        {client.email && (
          <Tip label={t('admin.galleries.resend_email')}>
            <button
              onClick={() => resendEmail(g._id)}
              disabled={resendingId === g._id}
              className='p-2 rounded-lg border border-border bg-muted/30 text-warm-gray hover:text-blush hover:bg-blush/10 transition-colors disabled:opacity-50'
            >
              {resentId === g._id ? <Check size={13} className='text-green-500' /> : <Mail size={13} />}
            </button>
          </Tip>
        )}
        {client.phone && (
          <Tip label={t('admin.galleries.send_sms')}>
            <button
              onClick={() => sendSms(g._id)}
              disabled={sendingSmId === g._id}
              className='p-2 rounded-lg border border-border bg-muted/30 text-warm-gray hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50'
            >
              {sentSmsId === g._id ? <Check size={13} className='text-green-500' /> : <MessageSquare size={13} />}
            </button>
          </Tip>
        )}
        {client.phone && (
          <Tip label={t('admin.galleries.whatsapp_send')}>
            <a
              href={whatsAppLink(g.token)}
              target='_blank'
              rel='noopener noreferrer'
              className='p-2 rounded-lg border border-border bg-muted/30 text-warm-gray hover:text-[#25D366] hover:bg-green-50 transition-colors'
            >
              <WhatsAppIcon size={13} />
            </a>
          </Tip>
        )}
        <Tip label={t('admin.client.view_gallery')}>
          <Link
            to={`/gallery/${g.token}`}
            target='_blank'
            className='p-2 rounded-lg border border-border bg-muted/30 text-warm-gray hover:text-charcoal hover:bg-muted transition-colors'
          >
            <ExternalLink size={13} />
          </Link>
        </Tip>

        <Link
          to={`/admin/galleries/${g._id}`}
          className='flex-1 flex items-center justify-center gap-1.5 text-xs bg-muted/30 text-charcoal px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors font-medium'
        >
          <Settings size={12} />
          {t('admin.galleries.manage')}
        </Link>
      </div>

      {/* Reactivate — reopen for client selection */}
      {!g.isDelivery && (g.status === 'selection_submitted' || g.status === 'in_editing' || g.status === 'delivered') && (
        <button
          onClick={() => reactivateGallery(g._id)}
          disabled={reactivatingId === g._id}
          className='mx-4 mb-3 flex items-center justify-center gap-1.5 w-[calc(100%-2rem)] text-xs text-amber-700 border border-dashed border-amber-300 bg-amber-50 rounded-lg py-2 hover:border-amber-400 hover:bg-amber-100 transition-colors disabled:opacity-60'
        >
          <RotateCcw size={12} />
          {reactivatingId === g._id ? t('admin.gallery.reactivating') : t('admin.gallery.reactivate')}
        </button>
      )}

      {/* Create delivery gallery */}
      {!g.isDelivery &&
        (g.status === 'selection_submitted' || g.status === 'in_editing' || g.status === 'delivered') &&
        !hasDelivery &&
        (showDeliveryFormFor === g._id ? (
          <div className='px-4 pb-4 pt-0 space-y-2 border-t border-border'>
            <div className='pt-3'>
              <input
                value={deliveryHeaderMessage}
                onChange={(e) => setDeliveryHeaderMessage(e.target.value)}
                placeholder={t('admin.client.delivery_header_ph')}
                className='w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
            </div>
            <div className='flex gap-2'>
              <button
                onClick={() => createDeliveryGallery(g._id)}
                disabled={creatingDeliveryFor === g._id}
                className='flex-1 bg-blush text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
              >
                {creatingDeliveryFor === g._id ? t('admin.client.creating_delivery') : t('admin.client.create_delivery')}
              </button>
              <button
                onClick={() => setShowDeliveryFormFor(null)}
                className='px-3 py-1.5 rounded-lg text-xs text-warm-gray border border-border hover:bg-muted/30 transition-colors'
              >
                {t('admin.common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeliveryFormFor(g._id)}
            className='mx-4 mb-4 flex items-center justify-center gap-1.5 w-[calc(100%-2rem)] text-xs text-warm-gray border border-dashed border-border rounded-lg py-2 hover:border-blush hover:text-blush transition-colors'
          >
            + {t('admin.client.create_delivery')}
          </button>
        ))}

      {/* Embedded delivery gallery */}
      {delivery && (
        <div className='border-t border-blush/30 bg-blush/5 px-4 py-3 flex flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <span className='text-[10px] font-medium text-blush uppercase tracking-wide'>{t('admin.client.delivery_suffix')}</span>
            <StatusBadge status={delivery.status} />
          </div>
          <div className='flex items-center gap-2'>
            <p className='text-xs font-medium text-charcoal flex-1 truncate'>{delivery.name}</p>
            <Tip label={t('admin.client.delete_gallery')}>
              <button
                onClick={() => setDeleteGalleryTarget(delivery._id)}
                className='p-1.5 rounded-lg border border-blush/20 bg-card text-warm-gray hover:text-rose-500 hover:bg-rose-50 transition-colors'
              >
                <Trash2 size={11} />
              </button>
            </Tip>
            <Tip label={t('admin.client.view_gallery')}>
              <Link
                to={`/gallery/${delivery.token}`}
                target='_blank'
                className='p-1.5 rounded-lg border border-blush/20 bg-card text-warm-gray hover:text-charcoal hover:bg-muted/30 transition-colors'
              >
                <ExternalLink size={11} />
              </Link>
            </Tip>
            <Link
              to={`/admin/galleries/${delivery._id}`}
              className='flex items-center gap-1 text-xs bg-card border border-blush/20 text-charcoal px-2.5 py-1 rounded-lg hover:bg-muted/30 transition-colors font-medium'
            >
              <Settings size={11} />
              {t('admin.galleries.manage')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
