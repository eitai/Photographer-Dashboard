import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGalleryLightbox } from '@/components/admin/AdminGalleryLightbox';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DeleteConfirmModal } from '@/components/admin/DeleteConfirmModal';
import { ImageGrid } from '@/components/admin/ImageGrid';
import { BulkActionBar } from '@/components/admin/BulkActionBar';
import { UploadQueue } from '@/components/admin/UploadQueue';
import { useGalleryUpload } from '@/hooks/useGalleryUpload';
import { useGalleryData } from '@/hooks/useGalleryData';
import { useImageDeletion } from '@/hooks/useImageDeletion';
import { useBeforeImageUpload } from '@/hooks/useBeforeImageUpload';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { useI18n } from '@/lib/i18n';
import { API_BASE } from '@/lib/api';
import { ArrowLeft, CloudUpload, Video, Trash2 } from 'lucide-react';
import { Button } from '@/components/admin/Button';

export const AdminGalleryUpload = () => {
  const { id } = useParams();
  const { t } = useI18n();

  const { gallery, setGallery, loadError, images, loadImages } = useGalleryData(id);
  const { queue, dragging, setDragging, inputRef, handleFiles, onDrop } = useGalleryUpload(id, loadImages);
  const { toDelete, setToDelete, bulkDeleting, confirmDelete } = useImageDeletion(id, () => {
    setSelectedIds(new Set());
    loadImages();
  });
  const { beforeInputRef, uploadingBefore, triggerUpload, handleBeforeUpload } = useBeforeImageUpload(id, loadImages);
  const { videoInputRef, videoQueue, deletingFilename, handleVideoUpload, handleVideoDelete } = useVideoUpload(
    id,
    setGallery,
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const toggleSelect = (imgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(imgId) ? next.delete(imgId) : next.add(imgId);
      return next;
    });
  };

  if (!gallery && !loadError)
    return (
      <AdminLayout title={t('admin.common.loading')}>
        <p className='text-warm-gray text-sm'>{t('admin.common.loading')}</p>
      </AdminLayout>
    );

  if (loadError)
    return (
      <AdminLayout title={t('admin.upload.load_failed')}>
        <p className='text-warm-gray text-sm'>{t('admin.upload.load_failed')}</p>
      </AdminLayout>
    );

  return (
    <AdminLayout>
      <Link
        to={gallery.clientId ? `/admin/clients/${gallery.clientId._id || gallery.clientId}` : '/admin/galleries'}
        className='flex items-center gap-1 text-sm text-warm-gray hover:text-charcoal mb-6'
      >
        <ArrowLeft size={14} /> {gallery.clientId ? t('admin.common.back_client') : t('admin.common.back_clients')}
      </Link>

      <div className='flex flex-wrap items-start justify-between gap-3 mb-6'>
        <div>
          <h1 className='text-2xl text-charcoal'>{gallery.name}</h1>
          <p className='text-sm text-warm-gray'>
            {gallery.clientName} · {images.length} {t('admin.upload.images')}
          </p>
        </div>
        <StatusBadge status={gallery.status} />
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={t('admin.upload.drop_images_label')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center cursor-pointer transition-colors mb-6 ${
          dragging ? 'border-blush bg-blush/10' : 'border-beige hover:border-blush/50 bg-card'
        }`}
      >
        <CloudUpload size={32} className='mx-auto text-warm-gray mb-3' />
        <p className='text-sm text-charcoal font-medium'>{t('admin.upload.drag')}</p>
        <p className='text-xs text-warm-gray mt-1'>{t('admin.upload.browse')}</p>
        <input
          ref={inputRef}
          type='file'
          multiple
          accept='image/*'
          className='hidden'
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <UploadQueue queue={queue} />

      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onDelete={() => setToDelete([...selectedIds])}
      />

      {images.length > 0 && (
        <ImageGrid
          images={images}
          selectedIds={selectedIds}
          uploadingBefore={uploadingBefore}
          onToggleSelect={toggleSelect}
          onOpenLightbox={setLightboxIndex}
          onRequestDelete={(imgId) => setToDelete([imgId])}
          onTriggerBeforeUpload={triggerUpload}
        />
      )}

      {images.length === 0 && queue.length === 0 && (
        <p className='text-sm text-warm-gray text-center py-8'>{t('admin.upload.no_images')}</p>
      )}

      {/* Video section */}
      <div className='mt-8 bg-card rounded-xl border border-beige p-6'>
        <div className='flex items-center gap-2 mb-4'>
          <Video size={16} className='text-warm-gray' />
          <h3 className='text-charcoal text-sm font-medium'>{t('admin.gallery.upload_video')}</h3>
          {(gallery.videos ?? []).length > 0 && (
            <span className='text-xs text-warm-gray bg-ivory px-2 py-0.5 rounded-full'>
              {(gallery.videos ?? []).length}
            </span>
          )}
        </div>

        {/* Uploaded videos list */}
        {(gallery.videos ?? []).length > 0 && (
          <div className='space-y-3 mb-4'>
            {(gallery.videos ?? []).map((v) => (
              <div key={v.filename} className='rounded-xl overflow-hidden border border-beige bg-black'>
                <video src={`${API_BASE}${v.path}`} controls className='w-full max-h-56' />
                <div className='flex items-center gap-2 px-3 py-2 bg-card'>
                  <span className='text-xs text-warm-gray truncate flex-1'>{v.originalName || v.filename}</span>
                  <Button
                    variant='danger'
                    size='sm'
                    className='shrink-0'
                    onClick={() => handleVideoDelete(v.filename)}
                    disabled={deletingFilename === v.filename}
                  >
                    <Trash2 size={12} />
                    {deletingFilename === v.filename ? t('admin.common.deleting') : t('admin.gallery.delete_video')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload queue progress */}
        {videoQueue.length > 0 && (
          <div className='space-y-2 mb-4'>
            {videoQueue.map((item) => (
              <div key={item.id} className='flex items-center gap-3 text-xs'>
                <span className='text-warm-gray truncate flex-1'>{item.name}</span>
                <div className='w-24 h-1.5 bg-beige rounded-full overflow-hidden'>
                  <div
                    className={`h-full rounded-full transition-all ${item.error ? 'bg-rose-400' : 'bg-blush'}`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <span className={item.error ? 'text-rose-500' : item.done ? 'text-green-500' : 'text-warm-gray'}>
                  {item.error ? t('admin.upload.error') : item.done ? t('admin.upload.done') : `${item.progress}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Drop zone — always visible so more videos can be added */}
        <input
          ref={videoInputRef}
          type='file'
          accept='video/*'
          multiple
          className='hidden'
          onChange={(e) => {
            if (e.target.files?.length) handleVideoUpload(e.target.files);
            e.target.value = '';
          }}
        />
        <div
          role="button"
          tabIndex={0}
          aria-label={t('admin.gallery.drop_video_label')}
          onClick={() => videoInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              videoInputRef.current?.click();
            }
          }}
          className='border-2 border-dashed border-beige hover:border-blush/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-ivory'
        >
          <Video size={24} className='mx-auto text-warm-gray mb-2' />
          <p className='text-sm text-charcoal font-medium'>{t('admin.gallery.upload_video')}</p>
          <p className='text-xs text-warm-gray mt-1'>mp4 · mov · avi · webm — {t('admin.gallery.upload_video_multi')}</p>
        </div>
      </div>

      <input
        ref={beforeInputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleBeforeUpload(file);
          e.target.value = '';
        }}
      />

      {toDelete.length > 0 && (
        <DeleteConfirmModal
          count={toDelete.length}
          deleting={bulkDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete([])}
        />
      )}

      {lightboxIndex !== null && (
        <AdminGalleryLightbox
          images={images}
          index={lightboxIndex}
          selectedIds={selectedIds}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i))}
          onToggleSelect={toggleSelect}
        />
      )}
    </AdminLayout>
  );
};
