import { useState } from 'react';
import { Images, Mail, Plus } from 'lucide-react';
import { createGallery as apiCreateGallery } from '@/services/galleryService';
import { GalleryGrid } from '@/components/admin/GalleryGrid';
import { useI18n } from '@/lib/i18n';
import type { Client } from '@/types/admin';
import type { GalleryData } from '@/types/gallery';

interface GalleriesSectionProps {
  galleries: GalleryData[];
  client: Client;
  onCreated: () => void;
  // GalleryGrid passthrough
  copiedId: string | null;
  resendingId: string | null;
  resentId: string | null;
  sendingSmId: string | null;
  sentSmsId: string | null;
  showDeliveryFormFor: string | null;
  deliveryHeaderMessage: string;
  creatingDeliveryFor: string | null;
  copyLink: (token: string, galleryId: string) => void;
  whatsAppLink: (token: string) => string;
  resendEmail: (id: string) => void;
  sendSms: (id: string) => void;
  setDeleteGalleryTarget: (id: string) => void;
  setShowDeliveryFormFor: (id: string | null) => void;
  setDeliveryHeaderMessage: (msg: string) => void;
  createDeliveryGallery: (id: string) => void;
}

export const GalleriesSection = ({
  galleries,
  client,
  onCreated,
  copiedId,
  resendingId,
  resentId,
  sendingSmId,
  sentSmsId,
  showDeliveryFormFor,
  deliveryHeaderMessage,
  creatingDeliveryFor,
  copyLink,
  whatsAppLink,
  resendEmail,
  sendSms,
  setDeleteGalleryTarget,
  setShowDeliveryFormFor,
  setDeliveryHeaderMessage,
  createDeliveryGallery,
}: GalleriesSectionProps) => {
  const { t } = useI18n();
  const [showGalleryForm, setShowGalleryForm] = useState(false);
  const [galleryForm, setGalleryForm] = useState({ name: '', headerMessage: '', maxSelections: 10 });
  const [savingGallery, setSavingGallery] = useState(false);
  const [lastEmailSent, setLastEmailSent] = useState<boolean | null>(null);

  const createGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGallery(true);
    const data = await apiCreateGallery({ ...galleryForm, clientId: client._id, clientName: client.name });
    setLastEmailSent(data.emailSent ?? null);
    setSavingGallery(false);
    setShowGalleryForm(false);
    setGalleryForm({ name: '', headerMessage: '', maxSelections: 10 });
    onCreated();
  };

  return (
    <div className='bg-card rounded-xl border border-beige p-6'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-2'>
          <Images size={16} className='text-warm-gray' />
          <h3 className=' text-charcoal'>{t('admin.client.galleries')}</h3>
          {galleries.length > 0 && (
            <span className='text-xs text-warm-gray bg-ivory px-2 py-0.5 rounded-full'>{galleries.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowGalleryForm(!showGalleryForm)}
          className='flex items-center gap-1.5 bg-blush text-primary-foreground px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-blush/80 transition-colors'
        >
          <Plus size={13} /> {t('admin.galleries.new')}
        </button>
      </div>

      {showGalleryForm && (
        <form onSubmit={createGallery} className='bg-ivory rounded-xl p-4 mb-5 space-y-3 border border-beige max-w-[50%]'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.galleries.name_label')}</label>
              <input
                required
                value={galleryForm.name}
                onChange={(e) => setGalleryForm({ ...galleryForm, name: e.target.value })}
                className='w-full px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.galleries.header_msg')}</label>
              <input
                value={galleryForm.headerMessage}
                onChange={(e) => setGalleryForm({ ...galleryForm, headerMessage: e.target.value })}
                className='w-full px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.max_selections')}</label>
              <input
                type='number'
                min={1}
                max={500}
                value={galleryForm.maxSelections}
                onChange={(e) => setGalleryForm({ ...galleryForm, maxSelections: Number(e.target.value) })}
                className='w-full px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
            </div>
          </div>
          <div className='flex gap-2'>
            <button
              type='submit'
              disabled={savingGallery}
              className='bg-blush text-primary-foreground px-4 py-1.5 rounded-xl text-xs font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {savingGallery ? t('admin.galleries.creating') : t('admin.galleries.create')}
            </button>
            <button
              type='button'
              onClick={() => setShowGalleryForm(false)}
              className='px-4 py-1.5 rounded-xl text-xs text-warm-gray border border-beige hover:bg-card transition-colors'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </form>
      )}

      {lastEmailSent !== null && (
        <div
          className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg mb-4 ${
            lastEmailSent ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          <Mail size={13} />
          {lastEmailSent ? t('admin.galleries.email_sent') : t('admin.galleries.no_email')}
          <button onClick={() => setLastEmailSent(null)} className='ml-auto opacity-60 hover:opacity-100'>
            ✕
          </button>
        </div>
      )}

      {galleries.length === 0 ? (
        <p className='text-sm text-warm-gray'>{t('admin.client.no_galleries')}</p>
      ) : (
        <GalleryGrid
          galleries={galleries}
          client={client}
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
          resendEmail={resendEmail}
          sendSms={sendSms}
          setDeleteGalleryTarget={setDeleteGalleryTarget}
          setShowDeliveryFormFor={setShowDeliveryFormFor}
          setDeliveryHeaderMessage={setDeliveryHeaderMessage}
          createDeliveryGallery={createDeliveryGallery}
        />
      )}
    </div>
  );
};
