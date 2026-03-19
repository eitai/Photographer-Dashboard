import { GalleryCard } from '@/components/admin/GalleryCard';

interface GalleryGridProps {
  galleries: any[];
  client: any;
  copiedId: string | null;
  resendingId: string | null;
  resentId: string | null;
  showDeliveryFormFor: string | null;
  deliveryHeaderMessage: string;
  creatingDeliveryFor: string | null;
  markingInEditingId: string | null;
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

export const GalleryGrid = ({
  galleries,
  client,
  copiedId,
  resendingId,
  resentId,
  showDeliveryFormFor,
  deliveryHeaderMessage,
  creatingDeliveryFor,
  markingInEditingId,
  t,
  copyLink,
  whatsAppLink,
  resendEmail,
  setDeleteGalleryTarget,
  setShowDeliveryFormFor,
  setDeliveryHeaderMessage,
  createDeliveryGallery,
  onMarkInEditing,
}: GalleryGridProps) => {
  // Build delivery map: originalId → delivery gallery (only for originals in this list)
  const deliveryByOriginalId = new Map<string, any>();
  galleries.forEach((g) => {
    if (g.isDelivery && g.deliveryOf) {
      const originalExists = galleries.some((o) => o._id === g.deliveryOf);
      if (originalExists) deliveryByOriginalId.set(g.deliveryOf, g);
    }
  });
  const pairedDeliveryIds = new Set([...deliveryByOriginalId.values()].map((d: any) => d._id));

  // Groups: paired originals + their delivery, or standalone
  const groups = galleries
    .filter((g) => !pairedDeliveryIds.has(g._id))
    .map((g) => {
      const delivery = deliveryByOriginalId.get(g._id);
      return delivery ? { type: 'pair' as const, original: g, delivery } : { type: 'single' as const, gallery: g };
    });

  const sharedCardProps = {
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
  };

  return (
    <div className='flex flex-col gap-3 w-full'>
      {groups.map((group) => {
        if (group.type === 'single') {
          return (
            <div key={group.gallery._id} className='grid grid-cols-2 gap-3'>
              <GalleryCard g={group.gallery} {...sharedCardProps} />
            </div>
          );
        }
        return (
          <div key={group.original._id} className='grid grid-cols-2 gap-3'>
            <GalleryCard g={group.original} {...sharedCardProps} />
            <GalleryCard g={group.delivery} {...sharedCardProps} />
          </div>
        );
      })}
    </div>
  );
};
