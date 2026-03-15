import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, CloudUpload, Check, Maximize2, ChevronLeft, ChevronRight, X, ImagePlus, ChevronDown } from 'lucide-react';

const STATUSES = ['gallery_sent', 'viewed', 'selection_submitted', 'in_editing', 'delivered'] as const;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface UploadFile {
  file: File;
  progress: number;
  done: boolean;
  error: boolean;
}

export const AdminGalleryUpload = () => {
  const { id } = useParams();
  const { t } = useI18n();
  const [gallery, setGallery] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [queue, setQueue] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // multi-select & delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // before image upload
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const [beforeTargetId, setBeforeTargetId] = useState<string | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState<string | null>(null);

  const loadGallery = async () => {
    try {
      const r = await api.get(`/galleries/${id}`);
      setGallery(r.data);
    } catch {
      setLoadError(true);
      toast.error(t('admin.upload.load_failed'));
    }
  };
  const loadImages = async () => {
    try {
      const r = await api.get(`/galleries/${id}/images`);
      setImages(r.data);
    } catch {
      toast.error(t('admin.upload.images_load_failed'));
    }
  };

  useEffect(() => {
    loadGallery();
    loadImages();
  }, [id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i));
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === 'Escape') setLightboxIndex(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, images.length]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
      setQueue((q) => [...q, ...arr.map((f) => ({ file: f, progress: 0, done: false, error: false }))]);

      const batches: File[][] = [];
      for (let i = 0; i < arr.length; i += 20) batches.push(arr.slice(i, i + 20));

      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];
        const formData = new FormData();
        batch.forEach((f) => formData.append('images', f));
        try {
          await api.post(`/galleries/${id}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (ev) => {
              const pct = Math.round((ev.loaded / (ev.total || 1)) * 100);
              setQueue((q) => q.map((item, idx) => (idx >= bi * 20 && idx < (bi + 1) * 20 ? { ...item, progress: pct } : item)));
            },
          });
          setQueue((q) =>
            q.map((item, idx) => (idx >= bi * 20 && idx < (bi + 1) * 20 ? { ...item, progress: 100, done: true } : item)),
          );
          loadImages();
        } catch {
          setQueue((q) => q.map((item, idx) => (idx >= bi * 20 && idx < (bi + 1) * 20 ? { ...item, error: true } : item)));
        }
      }

      setTimeout(() => setQueue([]), 1500);
    },
    [id],
  );

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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
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

      <div className='flex items-start justify-between mb-6'>
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
              await api.put(`/galleries/${id}`, { status: newStatus });
              setGallery((g: any) => ({ ...g, status: newStatus }));
            }}
            className='appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-beige bg-card text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 cursor-pointer'
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`admin.status.${s}`)}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className='absolute right-2 top-1/2 -translate-y-1/2 text-warm-gray pointer-events-none' />
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
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
          {queue.map((item, i) => (
            <div key={i} className='flex items-center gap-3 text-xs'>
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
        <div className='flex items-center gap-3 mb-4 px-4 py-3 bg-ivory rounded-xl border border-beige'>
          <span className='text-sm text-charcoal flex-1'>
            {selectedIds.size} {t('admin.upload.selected')}
          </span>
          <button onClick={() => setSelectedIds(new Set())} className='text-xs text-warm-gray hover:text-charcoal transition-colors'>
            {t('admin.upload.clear_selection')}
          </button>
          <button
            onClick={() => setToDelete([...selectedIds])}
            className='flex items-center gap-1.5 bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-rose-600 transition-colors'
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

                {/* Top-right: checkmark when selected, trash on hover when not selected */}
                {isSelected ? (
                  <div className='absolute top-1 right-1 w-5 h-5 rounded-full bg-blush flex items-center justify-center shadow'>
                    <Check size={11} className='text-charcoal' />
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setToDelete([img._id]);
                    }}
                    className='absolute top-1 right-1 bg-black/50 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity'
                    title={t('admin.upload.delete_title')}
                  >
                    <Trash2 size={11} />
                  </button>
                )}

                {/* Top-left: expand — always on hover regardless of selection */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(idx);
                  }}
                  className='absolute top-1 left-1 bg-black/50 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity'
                  title={t('admin.upload.open_title')}
                >
                  <Maximize2 size={11} />
                </button>

                {/* Bottom-left: upload "before" image */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBeforeTargetId(img._id);
                    beforeInputRef.current?.click();
                  }}
                  disabled={uploadingBefore === img._id}
                  className={`absolute bottom-1 left-1 p-1 rounded-md text-white transition-opacity ${
                    img.beforePath ? 'bg-blush/80 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'
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

      {/* Hidden input for "before" image upload */}
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

      {/* Delete confirmation modal */}
      {toDelete.length > 0 && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-4'>
          <div className='bg-card rounded-2xl border border-beige shadow-xl w-full max-w-sm p-6'>
            <h3 className=' text-lg text-charcoal mb-1'>{t('admin.upload.delete_confirm')}</h3>
            <p className='text-sm text-warm-gray mb-1'>
              <span className='font-medium text-charcoal'>
                {toDelete.length} {t('admin.upload.images')}
              </span>
            </p>
            <p className='text-sm text-warm-gray mb-6'>{t('admin.upload.delete_body')}</p>
            <div className='flex gap-3'>
              <button
                onClick={confirmDelete}
                disabled={bulkDeleting}
                className='flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
              >
                {bulkDeleting ? t('admin.upload.deleting') : t('admin.clients.delete_btn')}
              </button>
              <button
                onClick={() => setToDelete([])}
                disabled={bulkDeleting}
                className='flex-1 py-2 rounded-lg text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
              >
                {t('admin.common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox */}
      {lightboxIndex !== null &&
        (() => {
          const img = images[lightboxIndex];
          return (
            <div className='fixed inset-0 z-50 bg-black/90 flex items-center justify-center' onClick={() => setLightboxIndex(null)}>
              {/* Close */}
              <button
                onClick={() => setLightboxIndex(null)}
                className='absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors'
              >
                <X size={18} />
              </button>

              {/* Counter */}
              <p className='absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm'>
                {lightboxIndex + 1} / {images.length}
              </p>

              {/* Prev */}
              {lightboxIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(lightboxIndex - 1);
                  }}
                  className='absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors'
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              {/* Image */}
              <img
                src={`${API_BASE}${img.path}`}
                alt={img.originalName}
                className='max-w-full max-h-[90vh] rounded-xl object-contain px-16'
                onClick={(e) => e.stopPropagation()}
              />

              {/* Next */}
              {lightboxIndex < images.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(lightboxIndex + 1);
                  }}
                  className='absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors'
                >
                  <ChevronRight size={22} />
                </button>
              )}

              {/* Select toggle */}
              {(() => {
                const isSelected = selectedIds.has(img._id);
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(img._id);
                    }}
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isSelected ? 'bg-blush text-primary-foreground' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <Check size={14} />
                    {isSelected ? t('admin.upload.selected_one') : t('admin.upload.select')}
                  </button>
                );
              })()}
            </div>
          );
        })()}
    </AdminLayout>
  );
};
