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
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { useI18n } from '@/lib/i18n';
import { ArrowLeft, CloudUpload, Video, Trash2, X, Images } from 'lucide-react';
import { Button } from '@/components/admin/Button';

type Tab = 'images' | 'videos';

export const AdminGalleryUpload = () => {
  const { id } = useParams();
  const { t } = useI18n();

  const { gallery, setGallery, loadError, images, loadImages } = useGalleryData(id);
  const { queue, dragging, setDragging, inputRef, handleFiles, onDrop } = useGalleryUpload(id, loadImages);
  const { toDelete, setToDelete, bulkDeleting, confirmDelete } = useImageDeletion(id, () => {
    setSelectedIds(new Set());
    loadImages();
  });
  const { videoInputRef, videoQueue, deletingFilename, handleVideoUpload, handleVideoDelete, cancelUpload } = useVideoUpload(
    id,
    setGallery,
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('images');

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

  const videoCount = (gallery.videos ?? []).length;

  return (
    <AdminLayout>
      {/* Fills the layout content area — no outer scroll */}
      <div className='flex flex-col h-full -mx-4 md:-mx-8 -my-6 overflow-hidden'>
        {/* ── Header ── */}
        <div className='shrink-0 px-4 md:px-8 pt-4 pb-0 bg-white border-b border-beige'>
          {/* Back button */}
          <Link
            to={gallery.clientId ? `/admin/clients/${gallery.clientId._id || gallery.clientId}` : '/admin/galleries'}
            className='inline-flex items-center gap-1.5 text-xs text-warm-gray hover:text-charcoal mb-3 transition-colors group'
          >
            <span className='flex items-center justify-center w-5 h-5 rounded-full bg-beige group-hover:bg-blush/30 transition-colors'>
              <ArrowLeft size={11} />
            </span>
            {gallery.clientId ? t('admin.common.back_client') : t('admin.common.back_clients')}
          </Link>

          {/* Gallery title row */}
          <div className='flex items-start justify-between gap-4 mb-4'>
            <div className='min-w-0'>
              <h1 className='text-xl font-semibold text-charcoal truncate leading-tight'>{gallery.name}</h1>
              {gallery.clientName && <p className='text-sm text-warm-gray mt-0.5 truncate'>{gallery.clientName}</p>}
            </div>
            <div className='shrink-0 pt-0.5'>
              <StatusBadge status={gallery.status} />
            </div>
          </div>

          {/* Tab bar */}
          <div className='flex gap-1'>
            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                activeTab === 'images'
                  ? 'border-blush text-charcoal bg-white'
                  : 'border-transparent text-warm-gray hover:text-charcoal hover:bg-white/60'
              }`}
            >
              <Images size={14} />
              {t('admin.gallery.tab_images')}
              {images.length > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === 'images' ? 'bg-blush/20 text-charcoal' : 'bg-beige text-warm-gray'
                  }`}
                >
                  {images.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                activeTab === 'videos'
                  ? 'border-blush text-charcoal bg-white'
                  : 'border-transparent text-warm-gray hover:text-charcoal hover:bg-white/60'
              }`}
            >
              <Video size={14} />
              {t('admin.gallery.tab_videos')}
              {(videoCount > 0 || videoQueue.filter((v) => !v.done && !v.cancelled).length > 0) && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === 'videos' ? 'bg-blush/20 text-charcoal' : 'bg-beige text-warm-gray'
                  }`}
                >
                  {videoCount + videoQueue.filter((v) => !v.done && !v.cancelled).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── IMAGES TAB ── */}
        {activeTab === 'images' && (
          <div className='flex flex-col flex-1 overflow-hidden bg-white'>
            {/* Drop zone — compact, fixed */}
            <div className='shrink-0 px-4 md:px-8 pt-4'>
              <div
                role='button'
                tabIndex={0}
                aria-label={t('admin.upload.drop_images_label')}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-5 py-3 cursor-pointer transition-colors ${
                  dragging ? 'border-blush bg-blush/10' : 'border-beige hover:border-blush/50 bg-gray-50'
                }`}
              >
                <CloudUpload size={20} className='text-warm-gray shrink-0' />
                <div>
                  <p className='text-sm text-charcoal font-medium leading-tight'>{t('admin.upload.drag')}</p>
                  <p className='text-xs text-warm-gray'>{t('admin.upload.browse')}</p>
                </div>
                <input
                  ref={inputRef}
                  type='file'
                  multiple
                  accept='image/*'
                  className='hidden'
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </div>
            </div>

            {/* Upload queue + bulk bar — fixed */}
            <div className='shrink-0 px-4 md:px-8 pt-3'>
              <UploadQueue queue={queue} />
              <BulkActionBar
                count={selectedIds.size}
                onClear={() => setSelectedIds(new Set())}
                onDelete={() => setToDelete([...selectedIds])}
                allSelected={selectedIds.size === images.length && images.length > 0}
                onSelectAll={() =>
                  selectedIds.size === images.length
                    ? setSelectedIds(new Set())
                    : setSelectedIds(new Set(images.map((img) => img._id)))
                }
              />
            </div>

            {/* Image grid — only scrollable area */}
            <div className='flex-1 overflow-y-auto py-4 px-4 md:px-8 pb-6'>
              {images.length > 0 && (
                <ImageGrid
                  images={images}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onOpenLightbox={setLightboxIndex}
                  onRequestDelete={(imgId) => setToDelete([imgId])}
                />
              )}
              {images.length === 0 && queue.length === 0 && (
                <p className='text-sm text-warm-gray text-center py-16'>{t('admin.upload.no_images')}</p>
              )}
            </div>
          </div>
        )}

        {/* ── VIDEOS TAB ── */}
        {activeTab === 'videos' && (
          <div className='flex flex-col flex-1 overflow-hidden bg-white'>
            {/* Drop zone — compact, fixed */}
            <div className='shrink-0 px-4 md:px-8 pt-4'>
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
                role='button'
                tabIndex={0}
                aria-label={t('admin.gallery.drop_video_label')}
                onClick={() => videoInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    videoInputRef.current?.click();
                  }
                }}
                className='flex items-center gap-3 border-2 border-dashed border-beige hover:border-blush/50 rounded-xl px-5 py-3 cursor-pointer transition-colors bg-gray-50'
              >
                <Video size={20} className='text-warm-gray shrink-0' />
                <div>
                  <p className='text-sm text-charcoal font-medium leading-tight'>{t('admin.gallery.upload_video')}</p>
                  <p className='text-xs text-warm-gray'>mp4 · mov · avi · webm</p>
                </div>
              </div>
            </div>

            {/* Upload queue — fixed */}
            {videoQueue.length > 0 && (
              <div className='shrink-0 px-4 md:px-8 pt-3 space-y-2'>
                {videoQueue.map((item) => (
                  <div key={item.id} className='flex items-center gap-3 text-xs bg-gray-50 border border-beige rounded-xl px-3 py-2'>
                    <span className='text-warm-gray truncate flex-1'>{item.name}</span>
                    <div className='w-28 h-1.5 bg-beige rounded-full overflow-hidden shrink-0'>
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.error ? 'bg-rose-400' : item.cancelled ? 'bg-beige' : 'bg-blush'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span
                      className={`shrink-0 w-16 text-right ${
                        item.error
                          ? 'text-rose-500'
                          : item.cancelled
                            ? 'text-warm-gray'
                            : item.done
                              ? 'text-green-600'
                              : 'text-charcoal'
                      }`}
                    >
                      {item.error
                        ? t('admin.upload.error')
                        : item.cancelled
                          ? t('admin.gallery.video_cancelled')
                          : item.done
                            ? t('admin.upload.done')
                            : `${item.progress}%`}
                    </span>
                    {!item.done && !item.error && !item.cancelled && (
                      <button
                        onClick={() => cancelUpload(item.id)}
                        title={t('admin.gallery.cancel_upload')}
                        className='shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-beige hover:bg-rose-100 hover:text-rose-500 text-warm-gray transition-colors'
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Video list — only scrollable area */}
            <div className='flex-1 overflow-y-auto px-4 md:px-8 pt-3 pb-6'>
              {videoCount > 0 ? (
                <div className='space-y-2'>
                  {(gallery.videos ?? []).map((v) => (
                    <div key={v.filename} className='flex items-center gap-3 px-3 py-2 bg-gray-50 border border-beige rounded-xl'>
                      <div className='w-10 h-10 rounded-lg bg-beige flex items-center justify-center shrink-0'>
                        <Video size={16} className='text-warm-gray' />
                      </div>
                      <span className='text-xs text-charcoal truncate flex-1'>{v.originalName || v.filename}</span>
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
                  ))}
                </div>
              ) : (
                videoQueue.length === 0 && <p className='text-sm text-warm-gray text-center py-16'>{t('admin.upload.no_images')}</p>
              )}
            </div>
          </div>
        )}
      </div>

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
