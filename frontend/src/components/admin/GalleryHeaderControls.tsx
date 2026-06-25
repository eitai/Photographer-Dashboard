import { useI18n } from '@/lib/i18n';
import { Images, Eye, Infinity as InfinityIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateGallery } from '@/hooks/useQueries';
import type { Gallery } from '@/types/gallery';

interface Props {
  gallery: Gallery;
  galleryId: string;
  setGallery: (updater: (prev: Gallery) => Gallery) => void;
  expiresAtInput: string;
  setExpiresAtInput: (v: string) => void;
}

export const GalleryHeaderControls = ({ gallery, galleryId, setGallery, expiresAtInput, setExpiresAtInput }: Props) => {
  const { t } = useI18n();
  const updateGallery = useUpdateGallery();

  const handleSaveExpiry = async () => {
    try {
      const expiresAt = expiresAtInput ? new Date(expiresAtInput).toISOString() : null;
      await updateGallery.mutateAsync({ id: galleryId, data: { expiresAt } });
      toast.success(t('admin.gallery.expires_at_saved'));
    } catch {
      toast.error(t('admin.gallery.expires_at_save_failed'));
    }
  };

  return (
    <div className='w-full md:flex-1 md:min-w-0 space-y-3'>
      <div>
        <h1 className='text-xl font-semibold text-charcoal truncate leading-tight'>{gallery.name}</h1>
        {gallery.clientName && <p className='text-sm text-warm-gray mt-0.5 truncate'>{gallery.clientName}</p>}
      </div>

      {/* Selection enabled toggle */}
      <div className='flex items-center gap-2'>
        <label className='text-xs text-warm-gray shrink-0'>{t('admin.gallery.selection_enabled')}</label>
        <button
          type='button'
          onClick={async () => {
            const next = gallery.selectionEnabled === false ? true : false;
            try {
              await updateGallery.mutateAsync({ id: galleryId, data: { selectionEnabled: next } });
              toast.success(t('admin.gallery.selection_saved'));
            } catch {
              toast.error(t('admin.gallery.selection_save_failed'));
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            gallery.selectionEnabled !== false
              ? 'border-charcoal bg-ivory text-charcoal'
              : 'border-beige bg-muted/20 text-warm-gray'
          }`}
        >
          {gallery.selectionEnabled !== false
            ? <Images size={12} className='text-charcoal' />
            : <Eye size={12} />}
          {gallery.selectionEnabled !== false
            ? t('admin.gallery.selection_enabled_on')
            : t('admin.gallery.selection_enabled_off')}
        </button>
      </div>

      {/* Max selections */}
      <div className='flex items-center gap-2 flex-wrap'>
        <label className='text-xs text-warm-gray shrink-0'>{t('admin.client.max_selections')}</label>
        <input
          type='number'
          min={1}
          max={500}
          disabled={!gallery.selectionEnabled || (gallery.maxSelections ?? 10) === 0}
          value={(gallery.maxSelections ?? 10) === 0 ? '' : (gallery.maxSelections ?? 10)}
          onChange={(e) => setGallery((prev) => prev ? { ...prev, maxSelections: Number(e.target.value) } : prev)}
          onBlur={async (e) => {
            const val = Number(e.target.value);
            if (!val || val < 1) return;
            try {
              await updateGallery.mutateAsync({ id: galleryId, data: { maxSelections: val } });
              toast.success(t('admin.gallery.selection_saved'));
            } catch {
              toast.error(t('admin.gallery.selection_save_failed'));
            }
          }}
          placeholder='10'
          className='w-20 px-2.5 py-1.5 rounded-lg border border-beige bg-muted/30 text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20 disabled:opacity-40 disabled:cursor-not-allowed'
        />
        <button
          type='button'
          title={t('admin.users.unlimited_label')}
          disabled={!gallery.selectionEnabled}
          onClick={async () => {
            const next = (gallery.maxSelections ?? 10) === 0 ? 10 : 0;
            try {
              await updateGallery.mutateAsync({ id: galleryId, data: { maxSelections: next } });
            } catch {
              toast.error(t('admin.gallery.selection_save_failed'));
            }
          }}
          className={`shrink-0 p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            (gallery.maxSelections ?? 10) === 0
              ? 'bg-charcoal text-white border-charcoal'
              : 'border-beige text-warm-gray hover:border-charcoal/30 hover:text-charcoal'
          }`}
        >
          <InfinityIcon size={14} />
        </button>
      </div>

      {/* Expiry date */}
      <div className='flex items-center gap-2 flex-wrap'>
        <label className='text-xs text-warm-gray shrink-0'>{t('admin.gallery.expires_at_label')}</label>
        <input
          type='datetime-local'
          value={expiresAtInput}
          onChange={(e) => setExpiresAtInput(e.target.value)}
          className='px-2.5 py-1.5 rounded-lg border border-beige bg-muted/30 text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20'
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
          className='text-xs bg-charcoal text-white px-3 py-1.5 rounded-lg hover:bg-charcoal/90 transition-colors disabled:opacity-60'
        >
          {updateGallery.isPending ? t('admin.gallery.expires_at_saving') : t('admin.gallery.expires_at_save')}
        </button>
      </div>
    </div>
  );
};
