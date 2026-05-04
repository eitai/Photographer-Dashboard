import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGalleryLightbox } from '@/components/admin/AdminGalleryLightbox';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DeleteConfirmModal } from '@/components/admin/DeleteConfirmModal';
import { ImageGrid } from '@/components/admin/ImageGrid';
import { BulkActionBar } from '@/components/admin/BulkActionBar';
import { UploadQueue } from '@/components/admin/UploadQueue';
import { FolderSidebar } from '@/components/admin/FolderSidebar';
import { useGalleryUpload } from '@/hooks/useGalleryUpload';
import { useGalleryData } from '@/hooks/useGalleryData';
import { useImageDeletion } from '@/hooks/useImageDeletion';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { useUpdateGallery } from '@/hooks/useQueries';
import { useFolders } from '@/hooks/useFolders';
import { useI18n } from '@/lib/i18n';
import { getImageUrl } from '@/lib/api';
import { ArrowLeft, CloudUpload, Video, Trash2, X, Images, Eye, Infinity as InfinityIcon } from 'lucide-react';
import { Button } from '@/components/admin/Button';

/** Convert an ISO/DB timestamp to the value format expected by datetime-local inputs (YYYY-MM-DDTHH:mm). */
function toDatetimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  // Format: YYYY-MM-DDTHH:mm (no seconds, no timezone — browser treats it as local)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Tab = 'images' | 'videos';

export const AdminGalleryUpload = () => {
  const { id } = useParams();
  const { t } = useI18n();

  const { gallery, setGallery, loadError, images, loadImages } = useGalleryData(id);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const { folders, create: createFolder, rename: renameFolder, remove: removeFolder } = useFolders(id);
  const { queue, dragging, setDragging, inputRef, handleFiles, cancelUpload: cancelImageUpload, isUploading } = useGalleryUpload(id, loadImages);
  const { toDelete, setToDelete, bulkDeleting, deleteProgress, confirmDelete } = useImageDeletion(id, () => {
    setSelectedIds(new Set());
    loadImages();
  });
  const { videoInputRef, videoQueue, deletingFilename, handleVideoUpload, handleVideoDelete, cancelUpload } = useVideoUpload(
    id,
    setGallery,
  );

  const updateGallery = useUpdateGallery();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('images');
  const [expiresAtInput, setExpiresAtInput] = useState<string>('');

  // Seed the expiry input once when gallery data first arrives
  useEffect(() => {
    if (gallery) {
      setExpiresAtInput(toDatetimeLocal(gallery.expiresAt));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery?.expiresAt]);

  const visibleImages = activeFolderId
    ? images.filter((img) => img.folderIds?.includes(activeFolderId))
    : images;

  const toggleSelect = (imgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imgId)) next.delete(imgId); else next.add(imgId);
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

  const handleSaveExpiry = async () => {
    try {
      const expiresAt = expiresAtInput ? new Date(expiresAtInput).toISOString() : null;
      await updateGallery.mutateAsync({ id: id!, data: { expiresAt } });
      toast.success(t('admin.gallery.expires_at_saved'));
    } catch {
      toast.error(t('admin.gallery.expires_at_save_failed'));
    }
  };

  const videoCount = (gallery.videos ?? []).length;

  return (
    <AdminLayout>
      {/* Fills the layout content area — no outer scroll */}
      <div className='flex flex-col h-full -mx-4 md:-mx-8 -my-6 overflow-hidden'>
        {/* ── Header ── */}
        <div className='shrink-0 px-4 md:px-8 pt-4 pb-0 bg-background border-b border-beige'>
          {/* Back button */}
          <Link
            to={gallery.clientId ? `/admin/clients/${typeof gallery.clientId === 'object' ? gallery.clientId._id : gallery.clientId}` : '/admin/galleries'}
            className='inline-flex items-center gap-1.5 text-xs text-warm-gray hover:text-charcoal mb-3 transition-colors group'
          >
            <span className='flex items-center justify-center w-5 h-5 rounded-full bg-beige group-hover:bg-blush/30 transition-colors'>
              <ArrowLeft size={11} />
            </span>
            {gallery.clientId ? t('admin.common.back_client') : t('admin.common.back_clients')}
          </Link>

          {/* Gallery title row */}
          <div className='flex items-start justify-between gap-4 mb-3'>
            <div className='min-w-0'>
              <h1 className='text-xl font-semibold text-charcoal truncate leading-tight'>{gallery.name}</h1>
              {gallery.clientName && <p className='text-sm text-warm-gray mt-0.5 truncate'>{gallery.clientName}</p>}
            </div>
            <div className='shrink-0 pt-0.5'>
              <StatusBadge status={gallery.status} />
            </div>
          </div>

          {/* Selection enabled toggle */}
          <div className='flex items-center gap-2 mb-3'>
            <label className='text-xs text-warm-gray shrink-0'>{t('admin.gallery.selection_enabled')}</label>
            <button
              type='button'
              onClick={async () => {
                const next = gallery.selectionEnabled === false ? true : false;
                try {
                  await updateGallery.mutateAsync({ id: id!, data: { selectionEnabled: next } });
                  toast.success(t('admin.gallery.selection_saved'));
                } catch {
                  toast.error(t('admin.gallery.selection_save_failed'));
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                gallery.selectionEnabled !== false
                  ? 'border-blush bg-blush/10 text-charcoal'
                  : 'border-beige bg-muted/20 text-warm-gray'
              }`}
            >
              {gallery.selectionEnabled !== false ? <Images size={12} className='text-blush' /> : <Eye size={12} />}
              {gallery.selectionEnabled !== false ? t('admin.gallery.selection_enabled_on') : t('admin.gallery.selection_enabled_off')}
            </button>
          </div>

          {/* Max selections */}
          <div className='flex items-center gap-2 mb-3 flex-wrap'>
            <label className='text-xs text-warm-gray shrink-0'>{t('admin.client.max_selections')}</label>
            <input
              type='number'
              min={1}
              max={500}
              disabled={!gallery.selectionEnabled || (gallery.maxSelections ?? 10) === 0}
              value={(gallery.maxSelections ?? 10) === 0 ? '' : (gallery.maxSelections ?? 10)}
              onChange={(e) => setGallery((prev: typeof gallery) => prev ? { ...prev, maxSelections: Number(e.target.value) } : prev)}
              onBlur={async (e) => {
                const val = Number(e.target.value);
                if (!val || val < 1) return;
                try {
                  await updateGallery.mutateAsync({ id: id!, data: { maxSelections: val } });
                  toast.success(t('admin.gallery.selection_saved'));
                } catch {
                  toast.error(t('admin.gallery.selection_save_failed'));
                }
              }}
              placeholder='10'
              className='w-20 px-2.5 py-1.5 rounded-lg border border-beige bg-muted/30 text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 disabled:opacity-40 disabled:cursor-not-allowed'
            />
            <button
              type='button'
              title={t('admin.users.unlimited_label')}
              disabled={!gallery.selectionEnabled}
              onClick={async () => {
                const next = (gallery.maxSelections ?? 10) === 0 ? 10 : 0;
                try {
                  await updateGallery.mutateAsync({ id: id!, data: { maxSelections: next } });
                } catch {
                  toast.error(t('admin.gallery.selection_save_failed'));
                }
              }}
              className={`shrink-0 p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                (gallery.maxSelections ?? 10) === 0
                  ? 'bg-blush text-white border-blush'
                  : 'border-beige text-warm-gray hover:border-blush hover:text-blush'
              }`}
            >
              <InfinityIcon size={14} />
            </button>
          </div>

          {/* Expiry date editor */}
          <div className='flex items-center gap-2 mb-3 flex-wrap'>
            <label className='text-xs text-warm-gray shrink-0'>{t('admin.gallery.expires_at_label')}</label>
            <input
              type='datetime-local'
              value={expiresAtInput}
              onChange={(e) => setExpiresAtInput(e.target.value)}
              className='px-2.5 py-1.5 rounded-lg border border-beige bg-muted/30 text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
            />
            {expiresAtInput && (
              <button
                type='button'
                onClick={() => setExpiresAtInput('')}
                className='text-xs text-warm-gray hover:text-rose-500 transition-colors px-2 py-1 rounded-lg border border-beige hover:border-rose-200 hover:bg-rose-50'
              >
                {t('admin.gallery.expires_at_clear')}
              </button>
            )}
            <button
              type='button'
              onClick={handleSaveExpiry}
              disabled={updateGallery.isPending}
              className='text-xs bg-blush text-white px-3 py-1.5 rounded-lg hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {updateGallery.isPending ? t('admin.gallery.expires_at_saving') : t('admin.gallery.expires_at_save')}
            </button>
          </div>

          {/* Tab bar */}
          <div className='flex gap-1'>
            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                activeTab === 'images'
                  ? 'border-blush text-charcoal bg-card'
                  : 'border-transparent text-warm-gray hover:text-charcoal hover:bg-card/60'
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
                  ? 'border-blush text-charcoal bg-card'
                  : 'border-transparent text-warm-gray hover:text-charcoal hover:bg-card/60'
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
          <div className='flex flex-1 overflow-hidden bg-background'>
            {/* Folder sidebar */}
            <div className='w-48 shrink-0 border-e border-beige overflow-y-auto py-3 px-2'>
              <FolderSidebar
                folders={folders}
                activeFolderId={activeFolderId}
                onSelectFolder={(id) => { setActiveFolderId(id); setSelectedIds(new Set()); }}
                onCreateFolder={(name) => createFolder.mutateAsync(name)}
                onRenameFolder={(folderId, name) => renameFolder.mutate({ folderId, name })}
                onDeleteFolder={(folderId) => {
                  removeFolder.mutate(folderId);
                  if (activeFolderId === folderId) setActiveFolderId(null);
                }}
                imageCounts={Object.fromEntries(
                  folders.map((f) => [f._id, images.filter((img) => img.folderIds?.includes(f._id)).length])
                )}
                totalCount={images.length}
              />
            </div>

            {/* Main content area */}
            <div className='flex flex-col flex-1 overflow-hidden'>
              {/* Drop zone — compact, fixed */}
              <div className='shrink-0 px-4 md:px-6 pt-4'>
                {activeFolderId && (
                  <p className='text-xs text-blush font-medium mb-2'>
                    {t('admin.gallery.folder_uploading_to')} {folders.find((f) => f._id === activeFolderId)?.name}
                  </p>
                )}
                <div
                  role='button'
                  tabIndex={0}
                  aria-label={t('admin.upload.drop_images_label')}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files, activeFolderId); }}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
                  className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-5 py-3 cursor-pointer transition-colors ${
                    dragging ? 'border-blush bg-blush/10' : 'border-beige hover:border-blush/50 bg-muted/30'
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
                    onChange={(e) => e.target.files && handleFiles(e.target.files, activeFolderId)}
                  />
                </div>
              </div>

              {/* Upload queue + bulk bar — fixed */}
              <div className='shrink-0 px-4 md:px-6 pt-3'>
                <UploadQueue queue={queue} isUploading={isUploading} onCancel={cancelImageUpload} />
                <BulkActionBar
                  count={selectedIds.size}
                  onClear={() => setSelectedIds(new Set())}
                  onDelete={() => setToDelete([...selectedIds])}
                  allSelected={selectedIds.size === visibleImages.length && visibleImages.length > 0}
                  onSelectAll={() =>
                    selectedIds.size === visibleImages.length
                      ? setSelectedIds(new Set())
                      : setSelectedIds(new Set(visibleImages.map((img) => img._id)))
                  }
                />
              </div>

              {/* Image grid — only scrollable area */}
              <div className='flex-1 overflow-y-auto py-4 px-4 md:px-6 pb-6'>
                {visibleImages.length > 0 && (
                  <ImageGrid
                    images={visibleImages}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onOpenLightbox={(idx) => setLightboxIndex(images.indexOf(visibleImages[idx]))}
                    onRequestDelete={(imgId) => setToDelete([imgId])}
                  />
                )}
                {visibleImages.length === 0 && queue.length === 0 && (
                  <p className='text-sm text-warm-gray text-center py-16'>{t('admin.upload.no_images')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── VIDEOS TAB ── */}
        {activeTab === 'videos' && (
          <div className='flex flex-col flex-1 overflow-hidden bg-background'>
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
                className='flex items-center gap-3 border-2 border-dashed border-beige hover:border-blush/50 rounded-xl px-5 py-3 cursor-pointer transition-colors bg-muted/30'
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
                  <div key={item.id} className='flex items-center gap-3 text-xs bg-muted/30 border border-beige rounded-xl px-3 py-2'>
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
                    <div key={v.filename} className='flex items-center gap-3 px-3 py-2 bg-muted/30 border border-beige rounded-xl'>
                      <video
                        src={getImageUrl(v.path)}
                        preload='metadata'
                        className='w-16 h-10 rounded-lg object-cover shrink-0 bg-black'
                      />
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
          progress={deleteProgress}
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
