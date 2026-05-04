import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { useResendGalleryEmail, useSendGallerySms } from '@/hooks/useQueries';
import { toast } from 'sonner';
import { Mail, Link2, MessageSquare } from 'lucide-react';
import type { Client } from '@/types/admin';
import { GalleryMosaic } from './GalleryMosaic';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { WhatsAppIcon } from './WhatsAppIcon';
import type { RichGallery } from './types';

export const GalleryCard = ({ gallery, client }: { gallery: RichGallery; client: Client }) => {
  const { t } = useI18n();
  const resendEmail = useResendGalleryEmail(client._id);
  const sendSms = useSendGallerySms(client._id);

  const galleryUrl = gallery.token ? `${window.location.origin}/gallery/${gallery.token}` : null;

  const handleCopyLink = () => {
    if (!galleryUrl) return;
    navigator.clipboard.writeText(galleryUrl).then(() => {
      toast.success(t('admin.client.link_copied'));
    });
  };

  const handleSendEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    resendEmail.mutate(gallery._id, {
      onSuccess: () =>
        toast.success(t('admin.galleries.email_sent_success').replace('{name}', client.name), { description: gallery.name }),
      onError: () => toast.error(t('admin.galleries.email_sent_error').replace('{name}', client.name)),
    });
  };

  const handleSendSms = (e: React.MouseEvent) => {
    e.stopPropagation();
    sendSms.mutate(gallery._id, {
      onSuccess: () =>
        toast.success(t('admin.galleries.sms_sent_success').replace('{name}', client.name), { description: gallery.name }),
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg || t('admin.galleries.sms_sent_error').replace('{name}', client.name));
      },
    });
  };

  const whatsappHref = (() => {
    if (!galleryUrl || !client.phone) return null;
    const phone = client.phone.replace(/\D/g, '');
    const message = t('admin.galleries.whatsapp_msg').replace('{name}', client.name).replace('{url}', galleryUrl);
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  })();

  return (
    <div className='flex items-center gap-3 py-2 px-3 bg-card rounded-lg border border-border'>
      <GalleryMosaic name={gallery.name} />
      <div className='flex-1 min-w-0'>
        <Link
          to={`/admin/galleries/${gallery._id}`}
          className='text-sm font-sans font-medium text-charcoal truncate hover:text-blush hover:underline block'
          onClick={(e) => e.stopPropagation()}
        >
          {gallery.name}
        </Link>
        {gallery.isDelivery && <span className='text-xs text-warm-gray font-sans'>{t('admin.client.delivery_badge')}</span>}
      </div>
      <StatusBadge status={gallery.status} />
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target='_blank'
          rel='noreferrer'
          onClick={(e) => e.stopPropagation()}
          className='p-1.5 rounded-md text-warm-gray hover:text-[#25D366] hover:bg-beige transition-colors shrink-0'
          aria-label={t('admin.galleries.whatsapp_send')}
        >
          <WhatsAppIcon size={13} />
        </a>
      ) : (
        <span className='p-1.5 text-warm-gray/30 shrink-0 cursor-not-allowed' title={t('admin.common.no_phone')}>
          <WhatsAppIcon size={13} />
        </span>
      )}
      <button
        type='button'
        onClick={handleSendEmail}
        disabled={!client.email || resendEmail.isPending}
        className='p-1.5 rounded-xl text-warm-gray hover:text-blush hover:bg-beige transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed'
        aria-label={t('admin.galleries.resend_email')}
        title={client.email ? t('admin.galleries.resend_email') : t('admin.common.no_email')}
      >
        <Mail size={13} />
      </button>
      <button
        type='button'
        onClick={handleSendSms}
        disabled={!client.phone || sendSms.isPending}
        className='p-1.5 rounded-xl text-warm-gray hover:text-blue-500 hover:bg-beige transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed'
        aria-label={t('admin.galleries.send_sms')}
        title={client.phone ? t('admin.galleries.send_sms') : t('admin.common.no_phone')}
      >
        <MessageSquare size={13} />
      </button>
      <button
        type='button'
        onClick={handleCopyLink}
        className='p-1.5 rounded-xl text-warm-gray hover:text-charcoal hover:bg-beige transition-colors shrink-0'
        aria-label={t('admin.client.copy_link')}
      >
        <Link2 size={13} />
      </button>
    </div>
  );
};
