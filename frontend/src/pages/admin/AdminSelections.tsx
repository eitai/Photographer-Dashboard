import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import { API_BASE } from '@/lib/api';
import { toast } from 'sonner';
import { Download, Star, MessageCircle, Pencil } from 'lucide-react';
import { useGalleries, useUpdateGallery, useSubmissions, queryKeys } from '@/hooks/useQueries';
import { Button } from '@/components/admin/Button';
import { downloadZip } from '@/lib/downloadZip';
import type { GallerySubmission } from '@/types/gallery';

export const AdminSelections = () => {
  const { t } = useI18n();
  const { data: allGalleries = [] } = useGalleries();
  const galleries = allGalleries.filter((g) => g.status === 'selection_submitted');
  const updateGallery = useUpdateGallery(queryKeys.galleries);

  const [selected, setSelected] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: submissions = [], isLoading: loadingSub } = useSubmissions(selected ?? '');

  const markInEditing = (galleryId: string) => {
    updateGallery.mutate(
      { id: galleryId, data: { status: 'in_editing' } },
      {
        onSuccess: () => {
          if (selected === galleryId) {
            setSelected(null);
          }
        },
        onError: () => toast.error(t('admin.selections.mark_failed')),
      },
    );
  };

  const downloadAsZip = async (submission: GallerySubmission) => {
    setDownloading(true);
    await downloadZip(submission.selectedImageIds, 'selected-images', `selection-${submission._id}`);
    setDownloading(false);
  };

  const currentGallery = galleries.find((g) => g._id === selected);
  const markingInEditingId = updateGallery.isPending ? updateGallery.variables?.id ?? null : null;

  return (
    <AdminLayout title={t('admin.selections.title')}>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Gallery list */}
        <div className='bg-card rounded-xl border border-beige p-5'>
          <h2 className=' text-charcoal text-sm mb-4'>{t('admin.selections.galleries')}</h2>
          {galleries.length === 0 ? (
            <p className='text-xs text-warm-gray'>{t('admin.selections.no_galleries')}</p>
          ) : (
            <div className='space-y-2'>
              {galleries.map((g) => (
                <button
                  key={g._id}
                  onClick={() => setSelected(g._id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    selected === g._id ? 'bg-blush/20 text-charcoal font-medium' : 'text-charcoal hover:bg-ivory'
                  }`}
                >
                  <p>{g.name}</p>
                  <p className='text-xs text-warm-gray'>{g.clientName}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submissions */}
        <div className='lg:col-span-2'>
          {!selected ? (
            <div className='bg-card rounded-xl border border-beige p-8 text-center text-warm-gray text-sm'>
              {t('admin.selections.select_gallery')}
            </div>
          ) : loadingSub ? (
            <div className='bg-card rounded-xl border border-beige p-8 text-center text-warm-gray text-sm'>
              {t('admin.common.loading')}
            </div>
          ) : submissions.length === 0 ? (
            <div className='bg-card rounded-xl border border-beige p-8 text-center text-warm-gray text-sm'>
              {t('admin.selections.no_submissions')}
            </div>
          ) : (
            <div className='space-y-6'>
              {/* Per-gallery action: mark as in editing */}
              {currentGallery && (
                <div className='flex items-center justify-between bg-card rounded-xl border border-beige px-5 py-3'>
                  <div>
                    <p className='text-sm font-medium text-charcoal'>{currentGallery.name}</p>
                    <p className='text-xs text-warm-gray'>{currentGallery.clientName}</p>
                  </div>
                  <button
                    onClick={() => markInEditing(currentGallery._id)}
                    disabled={markingInEditingId === currentGallery._id}
                    className='flex items-center gap-2 bg-amber-50 border border-amber-200 text-charcoal px-4 py-2 rounded-xl text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-60'
                  >
                    <Pencil size={13} />
                    {markingInEditingId === currentGallery._id ? t('admin.gallery.marking') : t('admin.gallery.mark_in_editing')}
                  </button>
                </div>
              )}
              {submissions.map((sub) => (
                <div key={sub._id} className='bg-card rounded-xl border border-beige p-5'>
                  <div className='flex items-start justify-between mb-4'>
                    <div>
                      <p className='text-sm text-charcoal font-medium'>
                        {sub.selectedImageIds.length} {t('admin.selections.images_selected')}
                      </p>
                      <p className='text-xs text-warm-gray'>
                        {t('admin.selections.submitted')} {new Date(sub.submittedAt).toLocaleString()}
                      </p>
                      {sub.clientMessage && <p className='text-xs text-charcoal italic mt-1'>"{sub.clientMessage}"</p>}
                    </div>
                    <Button
                      variant='primary'
                      size='sm'
                      onClick={() => downloadAsZip(sub)}
                      disabled={downloading}
                    >
                      <Download size={13} />
                      {downloading ? t('admin.selections.preparing') : t('admin.selections.download')}
                    </Button>
                  </div>

                  {/* Thumbnail grid */}
                  <div className='grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5'>
                    {sub.selectedImageIds.map((img) => {
                      const isHero = (sub.heroImageId && img._id === sub.heroImageId.toString?.()) || img._id === sub.heroImageId;
                      const comment = sub.imageComments?.[img._id];
                      return (
                        <div key={img._id} className='relative aspect-square rounded-md overflow-hidden bg-beige group'>
                          <img
                            src={`${API_BASE}${img.path}`}
                            alt={img.filename}
                            className='w-full h-full object-cover'
                            loading='lazy'
                          />
                          {isHero && (
                            <div className='absolute top-1 left-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow'>
                              <Star size={10} fill='white' className='text-white' />
                            </div>
                          )}
                          {comment && (
                            <div
                              className='absolute bottom-1 right-1 w-5 h-5 rounded-full bg-blush flex items-center justify-center shadow'
                              title={comment}
                            >
                              <MessageCircle size={10} className='text-charcoal' />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
