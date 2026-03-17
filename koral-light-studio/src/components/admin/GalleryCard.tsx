import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Copy, Check, Mail, ExternalLink, Trash2 } from 'lucide-react';

interface GalleryCardProps {
  g: any;
  client: any;
  copiedId: string | null;
  resendingId: string | null;
  resentId: string | null;
  showDeliveryFormFor: string | null;
  deliveryHeaderMessage: string;
  creatingDeliveryFor: string | null;
  markingInEditingId: string | null;
  galleries: any[];
  t: (key: string) => string;
  copyLink: (token: string, galleryId: string) => void;
  whatsAppLink: (token: string) => string;
  resendEmail: (galleryId: string) => void;
  setDeleteGalleryTarget: (id: string | null) => void;
  setShowDeliveryFormFor: (id: string | null) => void;
  setDeliveryHeaderMessage: (msg: string) => void;
  createDeliveryGallery: (originalGalleryId: string) => void;
  onMarkInEditing: (galleryId: string) => void;
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
  markingInEditingId,
  galleries,
  t,
  copyLink,
  whatsAppLink,
  resendEmail,
  setDeleteGalleryTarget,
  setShowDeliveryFormFor,
  setDeliveryHeaderMessage,
  createDeliveryGallery,
  onMarkInEditing,
}: GalleryCardProps) => {
  const hasDelivery = galleries.some((g2) => g2.deliveryOf === g._id);

  return (
    <div className={`rounded-xl border p-4 h-full ${g.isDelivery ? 'border-blush/60 bg-blush/5' : 'border-beige bg-ivory'}`}>
      <div className='flex items-start justify-between mb-2'>
        <div>
          <p className='text-sm text-charcoal font-medium leading-tight'>{g.name}</p>
          {g.isDelivery && (
            <span className='inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blush/30 text-charcoal'>
              {t('admin.client.delivery_badge')}
            </span>
          )}
        </div>
        <div className='flex items-center gap-1.5'>
          <StatusBadge status={g.status} />
          <button
            onClick={() => setDeleteGalleryTarget(g._id)}
            className='p-1 rounded-lg text-warm-gray hover:text-rose-500 hover:bg-rose-50 transition-colors'
            title={t('admin.client.delete_gallery')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <p className='text-xs text-warm-gray font-mono truncate mb-3 bg-card px-2 py-1 rounded border border-beige/60'>
        {g.token}
      </p>

      <div className='flex items-center gap-1.5'>
        <Link
          to={`/admin/galleries/${g._id}`}
          className='flex-1 text-center text-xs bg-card text-charcoal px-2 py-1.5 rounded-lg border border-beige hover:bg-beige transition-colors font-medium'
        >
          {t('admin.galleries.manage')}
        </Link>
        <button
          onClick={() => copyLink(g.token, g._id)}
          className='p-1.5 rounded-lg border border-beige bg-card text-warm-gray hover:text-charcoal hover:bg-beige transition-colors'
          title={t('admin.client.copy_link')}
        >
          {copiedId === g._id ? <Check size={13} className='text-green-500' /> : <Copy size={13} />}
        </button>
        {client.email && (
          <button
            onClick={() => resendEmail(g._id)}
            disabled={resendingId === g._id}
            className='p-1.5 rounded-lg border border-beige bg-card text-warm-gray hover:text-charcoal hover:bg-beige transition-colors disabled:opacity-50'
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
            className='p-1.5 rounded-lg border border-beige bg-card hover:bg-beige transition-colors'
            title={t('admin.galleries.whatsapp_send')}
          >
            <svg width='13' height='13' viewBox='0 0 24 24' fill='#25D366'>
              <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
            </svg>
          </a>
        )}
        <Link
          to={`/gallery/${g.token}`}
          target='_blank'
          className='p-1.5 rounded-lg border border-beige bg-card text-warm-gray hover:text-charcoal hover:bg-beige transition-colors'
        >
          <ExternalLink size={13} />
        </Link>
      </div>

      {/* Last sent indicator */}
      {g.lastEmailSentAt && (
        <p className='flex items-center gap-1 mt-2 text-[10px] text-warm-gray'>
          <Mail size={10} />
          {t('admin.galleries.link_sent')} {new Date(g.lastEmailSentAt).toLocaleDateString()}
        </p>
      )}

      {/* Mark as In Editing — only for selection_submitted non-delivery galleries */}
      {!g.isDelivery && g.status === 'selection_submitted' && (
        <button
          onClick={() => onMarkInEditing(g._id)}
          disabled={markingInEditingId === g._id}
          className="mt-3 w-full text-xs text-charcoal bg-amber-50 border border-amber-200 rounded-lg py-1.5 hover:bg-amber-100 transition-colors disabled:opacity-60"
        >
          {markingInEditingId === g._id ? t('admin.gallery.marking') : t('admin.gallery.mark_in_editing')}
        </button>
      )}

      {/* Create delivery gallery — only if none exists yet for this gallery */}
      {!g.isDelivery &&
        g.status === 'selection_submitted' &&
        !hasDelivery &&
        (showDeliveryFormFor === g._id ? (
          <div className='mt-3 pt-3 border-t border-beige space-y-2'>
            <input
              value={deliveryHeaderMessage}
              onChange={(e) => setDeliveryHeaderMessage(e.target.value)}
              placeholder={t('admin.client.delivery_header_ph')}
              className='w-full px-3 py-2 rounded-lg border border-beige bg-card text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
            />
            <div className='flex gap-2'>
              <button
                onClick={() => createDeliveryGallery(g._id)}
                disabled={creatingDeliveryFor === g._id}
                className='flex-1 bg-blush text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
              >
                {creatingDeliveryFor === g._id ? t('admin.client.creating_delivery') : t('admin.client.create_delivery')}
              </button>
              <button
                onClick={() => setShowDeliveryFormFor(null)}
                className='px-3 py-1.5 rounded-lg text-xs text-warm-gray border border-beige hover:bg-card transition-colors'
              >
                {t('admin.common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeliveryFormFor(g._id)}
            className='mt-3 w-full text-xs text-blush border border-blush/30 rounded-lg py-1.5 hover:bg-blush/10 transition-colors'
          >
            + {t('admin.client.create_delivery')}
          </button>
        ))}

    </div>
  );
};
