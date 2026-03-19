import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n';

interface ConfirmationModalsProps {
  deleteSubTarget: { galleryId: string; submissionId: string } | null;
  deletingSubmission: boolean;
  deleteSubmission: () => void;
  setDeleteSubTarget: (v: null) => void;

  deleteGalleryTarget: string | null;
  deletingGallery: boolean;
  deleteGallery: () => void;
  setDeleteGalleryTarget: (v: null) => void;

  deleteImageTarget: { galleryId: string; submissionId: string; imageId: string } | null;
  deletingImage: boolean;
  deleteSubmissionImage: () => void;
  setDeleteImageTarget: (v: null) => void;
}

export const ConfirmationModals = ({
  deleteSubTarget,
  deletingSubmission,
  deleteSubmission,
  setDeleteSubTarget,
  deleteGalleryTarget,
  deletingGallery,
  deleteGallery,
  setDeleteGalleryTarget,
  deleteImageTarget,
  deletingImage,
  deleteSubmissionImage,
  setDeleteImageTarget,
}: ConfirmationModalsProps) => {
  const { t } = useI18n();

  return (
    <>
      <Modal isOpen={!!deleteSubTarget} onClose={() => setDeleteSubTarget(null)}>
        <h3 className=' text-lg text-charcoal mb-1'>{t('admin.selections.delete_sub_confirm')}</h3>
        <p className='text-sm text-warm-gray mb-6'>{t('admin.selections.delete_sub_body')}</p>
        <div className='flex gap-3'>
          <button
            onClick={deleteSubmission}
            disabled={deletingSubmission}
            className='flex-1 bg-rose-500 text-white py-3 min-h-[44px] rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
          >
            {deletingSubmission ? t('admin.selections.deleting') : t('admin.selections.delete_submission')}
          </button>
          <button
            onClick={() => setDeleteSubTarget(null)}
            disabled={deletingSubmission}
            className='flex-1 py-3 min-h-[44px] rounded-lg text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
          >
            {t('admin.common.cancel')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!deleteGalleryTarget} onClose={() => setDeleteGalleryTarget(null)}>
        <h3 className=' text-lg text-charcoal mb-1'>{t('admin.client.delete_gallery_confirm')}</h3>
        <p className='text-sm text-warm-gray mb-6'>{t('admin.client.delete_gallery_body')}</p>
        <div className='flex gap-3'>
          <button
            onClick={deleteGallery}
            disabled={deletingGallery}
            className='flex-1 bg-rose-500 text-white py-3 min-h-[44px] rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
          >
            {deletingGallery ? t('admin.common.deleting') : t('admin.client.delete_gallery')}
          </button>
          <button
            onClick={() => setDeleteGalleryTarget(null)}
            disabled={deletingGallery}
            className='flex-1 py-3 min-h-[44px] rounded-lg text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
          >
            {t('admin.common.cancel')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!deleteImageTarget} onClose={() => setDeleteImageTarget(null)}>
        <h3 className=' text-lg text-charcoal mb-1'>{t('admin.selections.delete_confirm')}</h3>
        <p className='text-sm text-warm-gray mb-6'>{t('admin.selections.delete_body')}</p>
        <div className='flex gap-3'>
          <button
            onClick={deleteSubmissionImage}
            disabled={deletingImage}
            className='flex-1 bg-rose-500 text-white py-3 min-h-[44px] rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
          >
            {deletingImage ? t('admin.selections.deleting') : t('admin.selections.delete_image')}
          </button>
          <button
            onClick={() => setDeleteImageTarget(null)}
            disabled={deletingImage}
            className='flex-1 py-3 min-h-[44px] rounded-lg text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
          >
            {t('admin.common.cancel')}
          </button>
        </div>
      </Modal>
    </>
  );
};
