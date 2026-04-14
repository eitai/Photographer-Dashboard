import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Copy, Check, Mail, ExternalLink, Trash2, Settings, Images } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Client } from '@/types/admin';
import type { GalleryData } from '@/types/gallery';
import { WhatsAppIcon } from '@/pages/admin/dashboard/WhatsAppIcon';
import { useGalleryPreviewImages } from '@/hooks/useQueries';
import { API_BASE } from '@/lib/api';

interface GalleryCardProps {
  g: GalleryData;
  client: Client;
  copiedId: string | null;
  resendingId: string | null;
  resentId: string | null;
  showDeliveryFormFor: string | null;
  deliveryHeaderMessage: string;
  creatingDeliveryFor: string | null;
  galleries: GalleryData[];
  copyLink: (token: string, galleryId: string) => void;
  whatsAppLink: (token: string) => string;
  resendEmail: (galleryId: string) => void;
  setDeleteGalleryTarget: (id: string | null) => void;
  setShowDeliveryFormFor: (id: string | null) => void;
  setDeliveryHeaderMessage: (msg: string) => void;
  createDeliveryGallery: (originalGalleryId: string) => void;
}

export const GalleryCard = ({
  g,
  client,
  copiedId,
  resendingId,
  resentId,
  showDeliveryFormFor,
  deliveryHeaderMessage,
  creatingDeliveryFor,
  galleries,
  copyLink,
  whatsAppLink,
  resendEmail,
  setDeleteGalleryTarget,
  setShowDeliveryFormFor,
  setDeliveryHeaderMessage,
  createDeliveryGallery,
}: GalleryCardProps) => {
  const { t } = useI18n();
  const hasDelivery = galleries.some((g2) => g2.deliveryOf === g._id);
  const { data: previewImages = [] } = useGalleryPreviewImages(g._id);

  return (
    <div
      className={`rounded-xl bg-white shadow-sm flex flex-col overflow-hidden ${g.isDelivery ? 'border border-blush/40' : 'border border-gray-100'}`}
    >
      {/* Top section: name/status + thumbnail placeholders */}
      <div className='flex items-start gap-3 p-4'>
        {/* Name + status — first in DOM = right side in RTL */}
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-charcoal truncate'>{g.name}</p>

          <div className='mt-1'>
            <StatusBadge status={g.status} />
          </div>
          {g.lastEmailSentAt && (
            <p className='flex items-center gap-1 mt-1 text-[10px] text-warm-gray'>
              <Mail size={9} />
              {new Date(g.lastEmailSentAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Thumbnails — left side in RTL, up to 5 */}
        <div className='flex gap-1.5 overflow-hidden'>
          {previewImages.length > 0 ? (
            previewImages.slice(0, 5).map((img) => (
              <img
                key={img._id}
                src={`${API_BASE}${img.thumbnailPath || img.path}`}
                alt=''
                className='w-16 h-16 rounded-lg object-cover border border-gray-100 shrink-0'
              />
            ))
          ) : (
            <div className='w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0'>
              <Images size={14} className='text-gray-300' />
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className='flex items-center gap-1.5 px-4 pb-4'>
        {/* Icon buttons */}
        <button
          onClick={() => setDeleteGalleryTarget(g._id)}
          className='p-2 rounded-lg border border-gray-100 bg-gray-50 text-warm-gray hover:text-rose-500 hover:bg-rose-50 transition-colors'
          title={t('admin.client.delete_gallery')}
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={() => copyLink(g.token, g._id)}
          className='p-2 rounded-lg border border-gray-100 bg-gray-50 text-warm-gray hover:text-charcoal hover:bg-gray-100 transition-colors'
          title={t('admin.client.copy_link')}
        >
          {copiedId === g._id ? <Check size={13} className='text-green-500' /> : <Copy size={13} />}
        </button>
        {client.email && (
          <button
            onClick={() => resendEmail(g._id)}
            disabled={resendingId === g._id}
            className='p-2 rounded-lg border border-gray-100 bg-gray-50 text-warm-gray hover:text-blush hover:bg-blush/10 transition-colors disabled:opacity-50'
            title={t('admin.galleries.resend_email')}
          >
            {resentId === g._id ? <Check size={13} className='text-green-500' /> : <Mail size={13} />}
          </button>
        )}
        {client.phone && (
          <a
            href={whatsAppLink(g.token)}
            target='_blank'
            rel='noopener noreferrer'
            className='p-2 rounded-lg border border-gray-100 bg-gray-50 text-warm-gray hover:text-[#25D366] hover:bg-green-50 transition-colors'
            title={t('admin.galleries.whatsapp_send')}
          >
            <WhatsAppIcon size={13} />
          </a>
        )}
        <Link
          to={`/gallery/${g.token}`}
          target='_blank'
          className='p-2 rounded-lg border border-gray-100 bg-gray-50 text-warm-gray hover:text-charcoal hover:bg-gray-100 transition-colors'
          title={t('admin.client.view_gallery')}
        >
          <ExternalLink size={13} />
        </Link>

        {/* Manage button — fills remaining space */}
        <Link
          to={`/admin/galleries/${g._id}`}
          className='flex-1 flex items-center justify-center gap-1.5 text-xs bg-gray-50 text-charcoal px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors font-medium'
        >
          <Settings size={12} />
          {t('admin.galleries.manage')}
        </Link>
      </div>

      {/* Create delivery gallery */}
      {!g.isDelivery &&
        (g.status === 'selection_submitted' || g.status === 'in_editing') &&
        !hasDelivery &&
        (showDeliveryFormFor === g._id ? (
          <div className='px-4 pb-4 pt-0 space-y-2 border-t border-gray-100'>
            <div className='pt-3'>
              <input
                value={deliveryHeaderMessage}
                onChange={(e) => setDeliveryHeaderMessage(e.target.value)}
                placeholder={t('admin.client.delivery_header_ph')}
                className='w-full px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
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
                className='px-3 py-1.5 rounded-lg text-xs text-warm-gray border border-gray-100 hover:bg-gray-50 transition-colors'
              >
                {t('admin.common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeliveryFormFor(g._id)}
            className='mx-4 mb-4 flex items-center justify-center gap-1.5 w-[calc(100%-2rem)] text-xs text-warm-gray border border-dashed border-gray-200 rounded-lg py-2 hover:border-blush hover:text-blush transition-colors'
          >
            + {t('admin.client.create_delivery')}
          </button>
        ))}
    </div>
  );
};
