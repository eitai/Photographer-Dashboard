import { useState } from 'react';
import { Images, Plus, Infinity } from 'lucide-react';
import { createGallery as apiCreateGallery } from '@/services/galleryService';
import { GalleryGrid } from '@/components/admin/GalleryGrid';
import { SessionTypeCombobox } from '@/components/admin/SessionTypeCombobox';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
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
  reactivateGallery: (id: string) => void;
  reactivatingId: string | null;
  setDeleteSubTarget: (t: { galleryId: string; submissionId: string } | null) => void;
  setDeleteImageTarget: (t: { galleryId: string; submissionId: string; imageId: string } | null) => void;
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
  reactivateGallery,
  reactivatingId,
  setDeleteSubTarget,
  setDeleteImageTarget,
}: GalleriesSectionProps) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showGalleryForm, setShowGalleryForm] = useState(false);
  const [galleryForm, setGalleryForm] = useState({ sessionType: '', headerMessage: '', maxSelections: 10 });
  const [savingGallery, setSavingGallery] = useState(false);

  const closeForm = () => {
    setShowGalleryForm(false);
    setGalleryForm({ sessionType: '', headerMessage: '', maxSelections: 10 });
  };

  const createGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGallery(true);
    try {
      const data = await apiCreateGallery({
        name: galleryForm.sessionType,
        headerMessage: galleryForm.headerMessage,
        maxSelections: galleryForm.maxSelections,
        sessionType: galleryForm.sessionType || undefined,
        clientId: client._id,
        clientName: client.name,
      });
      closeForm();
      toast({
        title: t('admin.galleries.create'),
        description: data.emailSent
          ? t('admin.galleries.email_sent')
          : t('admin.galleries.no_email'),
      });
      onCreated();
    } catch {
      toast({ title: t('admin.galleries.create_error') ?? 'Error', description: '' });
    } finally {
      setSavingGallery(false);
    }
  };

  return (
    <div className='bg-card rounded-xl border border-beige p-6 shadow-[1px_1px_5px_rgba(0,0,0,0.4)]'>
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

      <Modal isOpen={showGalleryForm} onClose={closeForm} maxWidth='max-w-md'>
        <h3 className='text-lg text-charcoal mb-4'>{t('admin.galleries.new')}</h3>
        <form onSubmit={createGallery} className='space-y-4'>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.session_type')}</label>
            <SessionTypeCombobox
              value={galleryForm.sessionType}
              onChange={(val) => setGalleryForm({ ...galleryForm, sessionType: val })}
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
            <div className='flex items-center gap-2'>
              <input
                type='number'
                min={1}
                max={500}
                disabled={galleryForm.maxSelections === 0}
                value={galleryForm.maxSelections === 0 ? '' : galleryForm.maxSelections}
                onChange={(e) => setGalleryForm({ ...galleryForm, maxSelections: Number(e.target.value) })}
                placeholder='10'
                className='flex-1 px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 disabled:opacity-40 disabled:cursor-not-allowed'
              />
              <button
                type='button'
                title='Unlimited'
                onClick={() => setGalleryForm((f) => ({ ...f, maxSelections: f.maxSelections === 0 ? 10 : 0 }))}
                className={`shrink-0 p-2 rounded-lg border transition-colors ${
                  galleryForm.maxSelections === 0
                    ? 'bg-blush text-white border-blush'
                    : 'border-beige text-warm-gray hover:border-blush hover:text-blush'
                }`}
              >
                <Infinity size={16} />
              </button>
            </div>
          </div>
          <div className='flex gap-2 pt-1'>
            <button
              type='submit'
              disabled={savingGallery}
              className='flex-1 bg-blush text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {savingGallery ? t('admin.galleries.creating') : t('admin.galleries.create')}
            </button>
            <button
              type='button'
              onClick={closeForm}
              className='flex-1 px-4 py-2 rounded-xl text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </form>
      </Modal>

      {galleries.length === 0 ? (
        <p className='text-sm text-warm-gray'>{t('admin.client.no_galleries')}</p>
      ) : (
        <div className='overflow-y-auto max-h-[70vh] pr-1'>
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
          reactivateGallery={reactivateGallery}
          reactivatingId={reactivatingId}
          setDeleteSubTarget={setDeleteSubTarget}
          setDeleteImageTarget={setDeleteImageTarget}
        />
        </div>
      )}
    </div>
  );
};
