import { GalleryCard } from '@/components/admin/GalleryCard';
import type { Client } from '@/types/admin';
import type { GalleryData } from '@/types/gallery';

interface GalleryGridProps {
  galleries: GalleryData[];
  client: Client;
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

export const GalleryGrid = ({
  galleries,
  client,
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
}: GalleryGridProps) => {
  // Build delivery map: originalId → delivery gallery
  const deliveryByOriginalId = new Map<string, GalleryData>();
  galleries.forEach((g) => {
    if (g.isDelivery && g.deliveryOf) {
      const originalExists = galleries.some((o) => o._id === g.deliveryOf);
      if (originalExists) deliveryByOriginalId.set(g.deliveryOf, g);
    }
  });
  const pairedDeliveryIds = new Set([...deliveryByOriginalId.values()].map((d) => d._id));

  // Only render originals (and standalone delivery galleries with no original in the list)
  const visibleGalleries = galleries.filter((g) => !pairedDeliveryIds.has(g._id));

  const sharedCardProps = {
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
  };

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
      {visibleGalleries.map((g) => (
        <GalleryCard
          key={g._id}
          g={g}
          delivery={deliveryByOriginalId.get(g._id)}
          {...sharedCardProps}
        />
      ))}
    </div>
  );
};
