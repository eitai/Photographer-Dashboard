import { CheckSquare, Download, Trash2, Star, MessageCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getImageUrl } from '@/lib/api';
import type { GalleryData, GallerySubmission } from '@/types/gallery';

interface SubmissionsSectionProps {
  galleries: GalleryData[];
  submissions: Record<string, GallerySubmission[]>;
  downloading: boolean;
  downloadAsZip: (submission: GallerySubmission) => void;
  setDeleteSubTarget: (target: { galleryId: string; submissionId: string } | null) => void;
  setDeleteImageTarget: (target: { galleryId: string; submissionId: string; imageId: string } | null) => void;
}

export const SubmissionsSection = ({
  galleries,
  submissions,
  downloading,
  downloadAsZip,
  setDeleteSubTarget,
  setDeleteImageTarget,
}: SubmissionsSectionProps) => {
  const { t } = useI18n();
  const galleriesWithSubs = galleries.filter((g) => submissions[g._id]?.length > 0);

  if (galleriesWithSubs.length === 0) return null;

  const totalSubs = galleriesWithSubs.reduce((acc, g) => acc + (submissions[g._id]?.length || 0), 0);

  return (
    <div className='bg-card rounded-xl border border-beige p-6'>
      <div className='flex items-center gap-2 mb-5'>
        <CheckSquare size={16} className='text-warm-gray' />
        <h3 className=' text-charcoal'>{t('admin.selections.title')}</h3>
        <span className='text-xs text-warm-gray bg-ivory px-2 py-0.5 rounded-full'>{totalSubs}</span>
      </div>
      <div className='space-y-6'>
        {galleriesWithSubs.map((g) => (
          <div key={g._id}>
            <p className='text-xs font-medium text-warm-gray uppercase tracking-wide mb-3'>{g.name}</p>
            {submissions[g._id]?.map((sub) => (
              <div key={sub._id} className='bg-ivory rounded-xl border border-beige p-4 mb-3'>
                <div className='flex items-start justify-between mb-3'>
                  <div>
                    <p className='text-sm text-charcoal font-medium'>
                      {sub.selectedImageIds.length} {t('admin.selections.images_selected')}
                    </p>
                    <p className='text-xs text-warm-gray'>
                      {t('admin.selections.submitted')} {new Date(sub.submittedAt).toLocaleString()}
                    </p>
                    {sub.clientMessage && <p className='text-xs text-charcoal italic mt-1'>"{sub.clientMessage}"</p>}
                  </div>
                  <div className='flex items-center gap-2'>
                    <button
                      onClick={() => downloadAsZip(sub)}
                      disabled={downloading}
                      className='flex items-center gap-2 bg-blush text-primary-foreground px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
                    >
                      <Download size={13} />
                      {downloading ? t('admin.selections.preparing') : t('admin.selections.download')}
                    </button>
                    <button
                      onClick={() => setDeleteSubTarget({ galleryId: g._id, submissionId: sub._id })}
                      className='p-1.5 rounded-xl border border-beige bg-card text-warm-gray hover:text-rose-500 hover:border-rose-200 transition-colors'
                      title={t('admin.selections.delete_submission')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className='grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5'>
                  {sub.selectedImageIds.map((img) => {
                    const isHero = sub.heroImageId && (img._id === sub.heroImageId?.toString?.() || img._id === sub.heroImageId);
                    const comment = sub.imageComments?.[img._id];
                    return (
                      <div key={img._id} className='relative group aspect-square rounded-md overflow-hidden bg-beige'>
                        <img
                          src={getImageUrl(img.thumbnailPath || img.path)}
                          alt={img.filename}
                          className='w-full h-full object-cover'
                          loading='lazy'
                        />
                        {isHero && (
                          <div className='absolute top-1 left-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow pointer-events-none'>
                            <Star size={10} fill='white' className='text-white' />
                          </div>
                        )}
                        {comment && (
                          <div
                            className='absolute bottom-1 right-1 w-5 h-5 rounded-full bg-blush flex items-center justify-center shadow pointer-events-none'
                            title={comment}
                          >
                            <MessageCircle size={10} className='text-charcoal' />
                          </div>
                        )}
                        <button
                          onClick={() => setDeleteImageTarget({ galleryId: g._id, submissionId: sub._id, imageId: img._id })}
                          className='absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity'
                          title={t('admin.selections.delete_image')}
                        >
                          <Trash2 size={14} className='text-white' />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
