import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGalleryLightbox } from '@/components/admin/AdminGalleryLightbox';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DeleteConfirmModal } from '@/components/admin/DeleteConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { ImageGrid } from '@/components/admin/ImageGrid';
import { BulkActionBar } from '@/components/admin/BulkActionBar';
import { UploadProgressToast } from '@/components/admin/UploadProgressToast';
import { FolderSidebar } from '@/components/admin/FolderSidebar';
import { FaceFilterStrip } from '@/components/gallery/FaceFilterStrip';
import { GalleryHeaderControls } from '@/components/admin/GalleryHeaderControls';
import { GalleryVideosTab } from '@/components/admin/GalleryVideosTab';
import { useGalleryUpload } from '@/hooks/useGalleryUpload';
import { useGalleryData } from '@/hooks/useGalleryData';
import { useImageDeletion } from '@/hooks/useImageDeletion';
import { useQueryClient } from '@tanstack/react-query';
import { useFolders } from '@/hooks/useFolders';
import { useI18n } from '@/lib/i18n';
import { ArrowLeft, CloudUpload, Images, Video } from 'lucide-react';

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
  const { t, dir } = useI18n();

  const { gallery, setGallery, loadError, images, loadImages } = useGalleryData(id);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFaceGroupKey, setActiveFaceGroupKey] = useState<string | null>(null);
  const [faceFilteredIds, setFaceFilteredIds] = useState<Set<string> | null>(null);
  const { folders, create: createFolder, rename: renameFolder, remove: removeFolder } = useFolders(id);
  const { queue, dragging, setDragging, inputRef, handleFiles, cancelUpload: cancelImageUpload, isUploading, uploadStats } = useGalleryUpload(id, loadImages);
  const { toDelete, setToDelete, bulkDeleting, deleteProgress, confirmDelete } = useImageDeletion(id, () => {
    setSelectedIds(new Set());
    loadImages();
  });
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('images');
  const [expiresAtInput, setExpiresAtInput] = useState<string>('');
  const [showCancelUploadModal, setShowCancelUploadModal] = useState(false);

  // Seed the expiry input once when gallery data first arrives
  useEffect(() => {
    if (gallery) {
      setExpiresAtInput(toDatetimeLocal(gallery.expiresAt));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery?.expiresAt]);

  // When upload finishes, reset the face groups cache so FaceFilterStrip
  // After upload finishes: kick the recognition status query so the status bar
  // appears immediately (it was idle because no job existed before the upload).
  // We also stagger a second refetch 1.5 s later to handle the fire-and-forget
  // timing on the backend (job insert happens after the 201 response is sent).
  const prevIsUploading = useRef(false);
  useEffect(() => {
    if (!prevIsUploading.current || isUploading || !id) {
      prevIsUploading.current = isUploading;
      return;
    }
    prevIsUploading.current = isUploading;
    queryClient.refetchQueries({ queryKey: ['faceGroups', id] });
    queryClient.refetchQueries({ queryKey: ['faceRecognitionStatus', id] });
    const t = setTimeout(() => {
      queryClient.refetchQueries({ queryKey: ['faceRecognitionStatus', id] });
    }, 1_500);
    return () => clearTimeout(t);
  }, [isUploading, id, queryClient]);

  const UPLOAD_TOAST_ID = 'gallery-upload-progress';
  useEffect(() => {
    if (uploadStats) {
      toast.custom(
        () => (
          <UploadProgressToast
            totalFiles={uploadStats.totalFiles}
            uploadedBytes={uploadStats.uploadedBytes}
            totalBytes={uploadStats.totalBytes}
            speedBps={uploadStats.speedBps}
            dir={dir}
            t={t}
            onRequestCancel={() => setShowCancelUploadModal(true)}
          />
        ),
        { id: UPLOAD_TOAST_ID, duration: Infinity, position: 'bottom-right' },
      );
    } else {
      toast.dismiss(UPLOAD_TOAST_ID);
    }
  }, [uploadStats, dir, t]);

  const visibleImages = (() => {
    let imgs = activeFolderId
      ? images.filter((img) => img.folderIds?.includes(activeFolderId))
      : images;
    if (faceFilteredIds !== null) {
      imgs = imgs.filter((img) => faceFilteredIds.has(img._id));
    }
    return imgs;
  })();

  const skeletonCount = queue.filter(
    (item) => !item.done && !item.error && !item.cancelled,
  ).length;

  useEffect(() => {
    setActiveFaceGroupKey(null);
    setFaceFilteredIds(null);
  }, [activeFolderId]);

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

  return (
    <AdminLayout>
      {/* Fills the layout content area — no outer scroll */}
      <div className='flex flex-col -mx-4 md:-mx-8 -my-6 md:h-full md:overflow-hidden'>
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

          {/* Two-column body: management controls (left) + status & upload (right) */}
          <div className='flex flex-col md:flex-row items-start gap-4 mb-3'>
            <GalleryHeaderControls
              gallery={gallery}
              galleryId={id!}
              setGallery={setGallery}
              expiresAtInput={expiresAtInput}
              setExpiresAtInput={setExpiresAtInput}
            />

            {/* ── Right: status badge + upload box ── */}
            <div className='w-full md:w-auto md:shrink-0 flex flex-col items-center gap-2'>
              <StatusBadge status={gallery.status} />
              <div
                role='button'
                tabIndex={0}
                aria-label={t('admin.upload.drop_images_label')}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files, activeFolderId); }}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
                }}
                className={`w-full md:w-48 h-48 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                  dragging ? 'border-charcoal bg-ivory' : 'border-beige hover:border-charcoal/30 bg-muted/30'
                }`}
              >
                <CloudUpload size={28} className='text-warm-gray shrink-0' />
                <div className='text-center px-3'>
                  <p className='text-sm text-charcoal font-medium leading-tight'>{t('admin.upload.drag')}</p>
                  <p className='text-xs text-warm-gray mt-0.5'>{t('admin.upload.browse')}</p>
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
              {activeFolderId && (
                <p className='text-[10px] text-charcoal font-medium text-center leading-tight'>
                  {folders.find((f) => f._id === activeFolderId)?.name}
                </p>
              )}
            </div>

          </div>

          {/* Tab bar */}
          <div className='flex gap-1'>
            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                activeTab === 'images'
                  ? 'bg-ivory border-b-2 border-charcoal text-charcoal'
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
                  ? 'bg-ivory border-b-2 border-charcoal text-charcoal'
                  : 'border-transparent text-warm-gray hover:text-charcoal hover:bg-card/60'
              }`}
            >
              <Video size={14} />
              {t('admin.gallery.tab_videos')}
              {(gallery.videos ?? []).length > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === 'videos' ? 'bg-blush/20 text-charcoal' : 'bg-beige text-warm-gray'
                  }`}
                >
                  {(gallery.videos ?? []).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── IMAGES TAB ── */}
        {activeTab === 'images' && (
          <div className='flex bg-background md:flex-1 md:overflow-hidden'>
              {/* Folder sidebar — desktop only */}
              <div className='hidden md:block w-72 shrink-0 border-e border-beige overflow-y-auto py-3 px-2'>
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
              <div className='flex flex-col w-full md:flex-1 md:overflow-hidden'>
                {/* Mobile folder chips — visible only below md */}
                {folders.length > 0 && (
                  <div className='md:hidden shrink-0 flex gap-2 overflow-x-auto px-4 pt-3 pb-2 border-b border-beige scrollbar-hide'>
                    <button
                      type='button'
                      onClick={() => { setActiveFolderId(null); setSelectedIds(new Set()); }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        activeFolderId === null ? 'bg-primary text-white' : 'bg-beige text-charcoal hover:bg-blush/30'
                      }`}
                    >
                      {t('gallery.folder_all')}
                      <span className='opacity-60'>{images.length}</span>
                    </button>
                    {folders.map((f) => (
                      <button
                        key={f._id}
                        type='button'
                        onClick={() => { setActiveFolderId(f._id); setSelectedIds(new Set()); }}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          activeFolderId === f._id ? 'bg-primary text-white' : 'bg-beige text-charcoal hover:bg-blush/30'
                        }`}
                      >
                        {f.name}
                        <span className='opacity-60'>
                          {images.filter((img) => img.folderIds?.includes(f._id)).length}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Face strip + bulk bar — fixed */}
                <div className='shrink-0 px-4 md:px-6 pt-3'>
                  {id && (
                    <FaceFilterStrip
                      galleryId={id}
                      showNames={true}
                      selectedGroupKey={activeFaceGroupKey}
                      onSelect={(groupKey, imageIds) => {
                        setActiveFaceGroupKey(groupKey);
                        setFaceFilteredIds(groupKey ? new Set(imageIds) : null);
                      }}
                    />
                  )}
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
                <div className='min-h-[55vh] md:min-h-0 md:flex-1 md:overflow-y-auto py-4 px-4 md:px-6 pb-6'>
                  {(visibleImages.length > 0 || skeletonCount > 0) && (
                    <ImageGrid
                      images={visibleImages}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onOpenLightbox={(idx) => setLightboxIndex(images.indexOf(visibleImages[idx]))}
                      onRequestDelete={(imgId) => setToDelete([imgId])}
                      skeletonCount={skeletonCount}
                    />
                  )}
                  {visibleImages.length === 0 && skeletonCount === 0 && (
                    <p className='text-sm text-warm-gray text-center py-16'>{t('admin.upload.no_images')}</p>
                  )}
                </div>
              </div>
          </div>
        )}

        {/* ── VIDEOS TAB ── */}
        {activeTab === 'videos' && (
          <GalleryVideosTab
            galleryId={id!}
            videos={gallery.videos ?? []}
            setGallery={setGallery}
          />
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

      {showCancelUploadModal && (
        <Modal isOpen onClose={() => setShowCancelUploadModal(false)}>
          <h3 className='text-lg text-charcoal mb-1'>{t('admin.upload.cancel_confirm_title')}</h3>
          <p className='text-sm text-warm-gray mb-6'>{t('admin.upload.cancel_confirm_body')}</p>
          <div className='flex gap-3'>
            <button
              onClick={() => {
                cancelImageUpload();
                setShowCancelUploadModal(false);
                toast.dismiss(UPLOAD_TOAST_ID);
              }}
              className='flex-1 bg-rose-500 text-white py-3 min-h-[44px] rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors'
            >
              {t('admin.upload.cancel_confirm_ok')}
            </button>
            <button
              onClick={() => setShowCancelUploadModal(false)}
              className='flex-1 py-3 min-h-[44px] rounded-xl text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
            >
              {t('admin.upload.cancel_confirm_keep')}
            </button>
          </div>
        </Modal>
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
