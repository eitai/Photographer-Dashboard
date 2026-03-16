import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminGalleryLightbox } from '@/components/admin/AdminGalleryLightbox';
import { DeleteConfirmModal } from '@/components/admin/DeleteConfirmModal';
import { useGalleryUpload } from '@/hooks/useGalleryUpload';
import { useI18n } from '@/lib/i18n';
import api, { API_BASE } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, CloudUpload, Check, Maximize2, ImagePlus, ChevronDown } from 'lucide-react';
import { GalleryDetail, GalleryImage } from '@/types/admin';

const STATUSES = ['gallery_sent', 'viewed', 'selection_submitted', 'in_editing', 'delivered'] as const;

export const AdminGalleryUpload = () => {
  const { id } = useParams();
  const { t } = useI18n();
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const [beforeTargetId, setBeforeTargetId] = useState<string | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState<string | null>(null);

  const loadImages = async () => {
    try {
      const r = await api.get(`/galleries/${id}/images`);
      setImages(r.data);
    } catch {
      setImages([]);
      toast.error(t('admin.upload.images_load_failed'));
    }
  };

  const loadGallery = async () => {
    try {
      const r = await api.get(`/galleries/${id}`);
      setGallery(r.data);
    } catch {
      setLoadError(true);
      toast.error(t('admin.upload.load_failed'));
    }
  };

  useEffect(() => {
    loadGallery();
    loadImages();
  }, [id]);

  const { queue, dragging, setDragging, inputRef, handleFiles, onDrop } = useGalleryUpload(id, loadImages);

  const toggleSelect = (imgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(imgId) ? next.delete(imgId) : next.add(imgId);
      return next;
    });
  };

  const confirmDelete = async () => {
    setBulkDeleting(true);
    await Promise.all(toDelete.map((imgId) => api.delete(`/galleries/${id}/images/${imgId}`)));
    setBulkDeleting(false);
    setToDelete([]);
    setSelectedIds(new Set());
    loadImages();
  };

  const handleBeforeUpload = async (file: File) => {
    if (!beforeTargetId) return;
    setUploadingBefore(beforeTargetId);
    const formData = new FormData();
    formData.append('before', file);
    try {
      await api.patch(`/galleries/${id}/images/${beforeTargetId}/before`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      loadImages();
    } finally {
      setUploadingBefore(null);
      setBeforeTargetId(null);
    }
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
        <ArrowLeft size={14} /> {t('admin.common.back_clients')}
      </Link>

      <div className='flex flex-wrap items-start justify-between gap-3 mb-6'>
        <div>
          <h1 className=' text-2xl text-charcoal'>{gallery.name}</h1>
          <p className='text-sm text-warm-gray'>
            {gallery.clientName} · {images.length} {t('admin.upload.images')}
          </p>
        </div>
        <div className='relative'>
          <select
            value={gallery.status}
            onChange={async (e) => {
              const newStatus = e.target.value;
              const prevStatus = gallery.status;
              setGallery((g) => g ? { ...g, status: newStatus } : g);
              try {
                await api.put(`/galleries/${id}`, { status: newStatus });
              } catch {
                setGallery((g) => g ? { ...g, status: prevStatus } : g);
                toast.error(t('admin.upload.status_update_failed'));
              }
            }}
            className='appearance-none ps-3 pe-8 py-2.5 min-h-[44px] rounded-lg border border-beige bg-card text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 cursor-pointer'
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`admin.status.${s}`)}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className='absolute end-2 top-1/2 -translate-y-1/2 text-warm-gray pointer-events-none' />
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
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

      {/* Upload queue */}
      {queue.length > 0 && (
        <div className='bg-card rounded-xl border border-beige p-4 mb-6 max-h-48 overflow-y-auto space-y-2'>
          {queue.map((item) => (
            <div key={item.id} className='flex items-center gap-3 text-xs'>
              <span className='text-warm-gray truncate flex-1'>{item.file.name}</span>
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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className='flex flex-wrap items-center gap-3 mb-4 px-4 py-3 bg-ivory rounded-xl border border-beige'>
          <span className='text-sm text-charcoal flex-1'>
            {selectedIds.size} {t('admin.upload.selected')}
          </span>
          <button onClick={() => setSelectedIds(new Set())} className='text-xs text-warm-gray hover:text-charcoal transition-colors'>
            {t('admin.upload.clear_selection')}
          </button>
          <button
            onClick={() => setToDelete([...selectedIds])}
            className='flex items-center gap-1.5 bg-rose-500 text-white px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium hover:bg-rose-600 transition-colors'
          >
            <Trash2 size={12} />
            {t('admin.upload.delete_selected')}
          </button>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2'>
          {images.map((img, idx) => {
            const isSelected = selectedIds.has(img._id);
            return (
              <div
                key={img._id}
                onClick={() => toggleSelect(img._id)}
                className={`relative group aspect-square rounded-lg overflow-hidden bg-beige cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-blush ring-offset-1' : ''
                }`}
              >
                <img
                  src={`${API_BASE}${img.thumbnailPath || img.path}`}
                  alt={img.originalName}
                  className='w-full h-full object-cover'
                  loading='lazy'
                />

                {isSelected ? (
                  <div className='absolute top-1 right-1 w-5 h-5 rounded-full bg-blush flex items-center justify-center shadow'>
                    <Check size={11} className='text-charcoal' />
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setToDelete([img._id]); }}
                    className='absolute top-1 end-1 bg-black/50 text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity'
                    title={t('admin.upload.delete_title')}
                  >
                    <Trash2 size={11} />
                  </button>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                  className='absolute top-1 start-1 bg-black/50 text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity'
                  title={t('admin.upload.open_title')}
                >
                  <Maximize2 size={11} />
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); setBeforeTargetId(img._id); beforeInputRef.current?.click(); }}
                  disabled={uploadingBefore === img._id}
                  className={`absolute bottom-1 start-1 p-1.5 rounded-md text-white transition-opacity ${
                    img.beforePath ? 'bg-blush/80 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
                  } ${uploadingBefore === img._id ? 'opacity-60' : ''}`}
                  title='Upload before image'
                >
                  <ImagePlus size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {images.length === 0 && queue.length === 0 && (
        <p className='text-sm text-warm-gray text-center py-8'>{t('admin.upload.no_images')}</p>
      )}

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
