import { useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getClientFaceReference,
  uploadClientFaceReference,
  deleteClientFaceReference,
  getImageUrl,
  type FaceReferenceStatus,
} from '@/lib/api';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ScanFace, Upload, Trash2, RefreshCw, Loader2 } from 'lucide-react';

interface ClientFaceReferenceCardProps {
  clientId: string;
  faceRecognitionEnabled?: boolean;
}

const QUERY_KEY = (clientId: string) => ['clientFaceReference', clientId] as const;

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ClientFaceReferenceCard = ({ clientId, faceRecognitionEnabled: initialEnabled = false }: ClientFaceReferenceCardProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // -------------------------------------------------------------------------
  // Query — fetch reference status
  // -------------------------------------------------------------------------
  const { data: reference, isLoading } = useQuery<FaceReferenceStatus>({
    queryKey: QUERY_KEY(clientId),
    queryFn: () => getClientFaceReference(clientId),
    staleTime: 60_000,
  });

  // -------------------------------------------------------------------------
  // Mutation — upload reference
  // -------------------------------------------------------------------------
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadClientFaceReference(clientId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(clientId) });
      toast.success(t('admin.face.upload_success'));
    },
    onError: () => {
      toast.error(t('admin.face.upload_failed'));
    },
  });

  // -------------------------------------------------------------------------
  // Mutation — delete reference
  // -------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: () => deleteClientFaceReference(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(clientId) });
      toast.success(t('admin.face.remove_success'));
    },
    onError: () => {
      toast.error(t('admin.face.remove_failed'));
    },
  });

  // -------------------------------------------------------------------------
  // Mutation — toggle face recognition enabled
  // -------------------------------------------------------------------------
  const [faceEnabled, setFaceEnabled] = useState<boolean>(initialEnabled);
  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch(`/clients/${clientId}`, { faceRecognitionEnabled: enabled }).then((r) => r.data),
    onSuccess: (_data, enabled) => {
      setFaceEnabled(enabled);
      queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
      toast.success(enabled ? t('admin.face.enabled_success') : t('admin.face.disabled_success'));
    },
    onError: () => {
      toast.error(t('admin.face.toggle_failed'));
    },
  });

  // -------------------------------------------------------------------------
  // File validation + upload trigger
  // -------------------------------------------------------------------------
  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(t('admin.face.invalid_type'));
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(t('admin.face.too_large'));
        return;
      }
      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = () => {
    if (!window.confirm(t('admin.face.confirm_remove'))) return;
    deleteMutation.mutate();
  };

  const isBusy = uploadMutation.isPending || deleteMutation.isPending;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className='bg-card rounded-2xl border border-beige shadow-[1px_1px_5px_rgba(0,0,0,0.4)] overflow-hidden'>
      {/* Header */}
      <div className='px-6 py-4 border-b border-beige flex items-center gap-2'>
        <span className='flex items-center justify-center w-7 h-7 rounded-full bg-blush/20 text-rose-600 shrink-0'>
          <ScanFace size={15} />
        </span>
        <h3 className='text-sm font-semibold text-charcoal'>{t('admin.face.card_title')}</h3>
      </div>

      {/* Body */}
      <div className='px-6 py-5'>
        {isLoading ? (
          <div className='flex items-center gap-2 text-sm text-warm-gray'>
            <Loader2 size={14} className='animate-spin' />
            <span>{t('admin.common.loading')}</span>
          </div>
        ) : reference?.hasReference ? (
          // ── Reference exists ──────────────────────────────────────────────
          <div className='flex items-start gap-4 flex-wrap'>
            {/* Thumbnail */}
            <div className='shrink-0'>
              <img
                src={getImageUrl(reference.imagePath!)}
                alt='Face reference'
                className='w-20 h-20 rounded-xl object-cover border border-beige'
              />
            </div>

            {/* Meta + actions */}
            <div className='flex flex-col gap-3 flex-1 min-w-0'>
              {/* Model version + updated */}
              <div className='space-y-0.5'>
                {reference.modelVersion && (
                  <p className='text-xs text-warm-gray'>
                    {t('admin.face.model_label')} <span className='text-charcoal font-medium'>{reference.modelVersion}</span>
                  </p>
                )}
                {reference.updatedAt && (
                  <p className='text-xs text-warm-gray'>
                    {t('admin.face.updated_label')}{' '}
                    <span className='text-charcoal'>
                      {new Date(reference.updatedAt).toLocaleDateString()}
                    </span>
                  </p>
                )}
              </div>

              {/* Face recognition toggle */}
              <div className='flex items-center gap-2'>
                <span className='text-xs text-warm-gray'>{t('admin.face.toggle_label')}</span>
                <button
                  type='button'
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate(!(faceEnabled))}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blush/50 disabled:opacity-50',
                    (faceEnabled) ? 'bg-blush' : 'bg-beige',
                  )}
                  role='switch'
                  aria-checked={faceEnabled}
                  aria-label={t('admin.face.toggle_aria')}
                >
                  <span
                    className={cn(
                      'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                      (faceEnabled) ? 'translate-x-4' : 'translate-x-0',
                    )}
                  />
                </button>
              </div>

              {/* Action buttons */}
              <div className='flex items-center gap-2 flex-wrap'>
                <button
                  type='button'
                  disabled={isBusy}
                  onClick={() => inputRef.current?.click()}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-beige text-warm-gray hover:text-charcoal hover:bg-ivory transition-colors disabled:opacity-50'
                >
                  {uploadMutation.isPending ? (
                    <Loader2 size={12} className='animate-spin' />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {t('admin.face.replace')}
                </button>
                <button
                  type='button'
                  disabled={isBusy}
                  onClick={handleDelete}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50'
                >
                  {deleteMutation.isPending ? (
                    <Loader2 size={12} className='animate-spin' />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  {t('admin.face.remove')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // ── No reference ──────────────────────────────────────────────────
          <div className='space-y-3'>
            <p className='text-sm text-warm-gray'>{t('admin.face.no_reference')}</p>

            {/* Drop zone */}
            <div
              role='button'
              tabIndex={0}
              aria-label={t('admin.face.upload_aria')}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 cursor-pointer transition-colors',
                dragging
                  ? 'border-blush bg-blush/10'
                  : 'border-beige hover:border-blush/50 bg-muted/20',
                uploadMutation.isPending && 'pointer-events-none opacity-60',
              )}
            >
              {uploadMutation.isPending ? (
                <Loader2 size={20} className='animate-spin text-blush' />
              ) : (
                <Upload size={20} className='text-warm-gray' />
              )}
              <p className='text-sm text-charcoal font-medium'>
                {uploadMutation.isPending ? t('admin.common.uploading') : t('admin.face.drop_prompt')}
              </p>
              <p className='text-xs text-warm-gray'>{t('admin.face.format_hint')}</p>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type='file'
          accept='image/jpeg,image/png,image/webp'
          className='hidden'
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
};
