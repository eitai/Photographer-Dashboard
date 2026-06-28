import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { SESSION_TYPE_KEYS } from '@/components/admin/SessionTypeComboboxConstants';
import { useUpdateProductOrderGalleries } from '@/hooks/useQueries';
import type { ProductOrder } from '@/services/productOrderService';
import type { Gallery } from '@/types/gallery';

interface Props {
  order: ProductOrder;
  clientId: string;
  galleries: Gallery[];
}

type AllowedGallery = { _id: string; name: string } | string;

const GalleryChips = ({ allowedGalleryIds, tGallery, emptyLabel }: {
  allowedGalleryIds: AllowedGallery[];
  tGallery: (name: string) => string;
  emptyLabel: string;
}) => {
  if (!allowedGalleryIds.length) {
    return <span className='text-[11px] text-warm-gray/60 italic'>{emptyLabel}</span>;
  }
  return (
    <div className='flex flex-wrap gap-1 mt-1'>
      {allowedGalleryIds.map((g) => {
        const name = tGallery(typeof g === 'string' ? g : g.name);
        const key = typeof g === 'string' ? g : g._id;
        return (
          <span key={key} className='text-[11px] bg-beige/60 text-warm-gray px-2 py-0.5 rounded-full border border-beige'>
            {name}
          </span>
        );
      })}
    </div>
  );
};

export const ProductOrderGalleries = ({ order, clientId, galleries }: Props) => {
  const { t } = useI18n();
  const updateGalleries = useUpdateProductOrderGalleries(clientId);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tGallery = (name: string) => {
    if (!SESSION_TYPE_KEYS.includes(name)) return name;
    const translated = t(`admin.session.${name}`);
    return translated.startsWith('admin.session.') ? name : translated;
  };

  const openEditor = () => {
    const currentIds = (order.allowedGalleryIds as AllowedGallery[]).map((g) =>
      typeof g === 'string' ? g : g._id
    );
    setDraft(currentIds);
    setError('');
    setIsEditing(true);
  };

  const toggleGallery = (galleryId: string) => {
    setDraft((d) =>
      d.includes(galleryId) ? d.filter((id) => id !== galleryId) : [...d, galleryId]
    );
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateGalleries.mutateAsync({ orderId: order._id, allowedGalleryIds: draft });
      setIsEditing(false);
    } catch {
      setError(t('admin.products.gallery_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const allowedIds = Array.isArray(order.allowedGalleryIds) ? order.allowedGalleryIds as AllowedGallery[] : [];

  return (
    <div className='px-4 py-3 bg-ivory/40'>
      <p className='text-[11px] font-medium text-warm-gray uppercase tracking-wide mb-1'>
        {t('admin.products.galleries_section_label')}
      </p>

      {order.status !== 'submitted' ? (
        <div className='flex items-start gap-2 flex-wrap'>
          <GalleryChips
            allowedGalleryIds={allowedIds}
            tGallery={tGallery}
            emptyLabel={t('admin.products.no_galleries_selected')}
          />
          <button
            onClick={() => isEditing ? setIsEditing(false) : openEditor()}
            className='text-[11px] text-blush hover:text-blush/80 transition-colors flex items-center gap-1 cursor-pointer'
          >
            <Pencil size={9} />
            {t('admin.products.edit_galleries')}
          </button>
        </div>
      ) : (
        <GalleryChips
          allowedGalleryIds={allowedIds}
          tGallery={tGallery}
          emptyLabel={t('admin.products.no_galleries_selected')}
        />
      )}

      {isEditing && (
        <div className='mt-2 border border-beige rounded-lg p-3 bg-ivory space-y-2'>
          {galleries.length === 0 ? (
            <p className='text-xs text-warm-gray'>{t('admin.products.no_galleries')}</p>
          ) : (
            <ul className='max-h-48 overflow-y-auto space-y-1 pe-1'>
              {galleries.map((g) => (
                <li key={g._id} className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    id={`gallery-${order._id}-${g._id}`}
                    checked={draft.includes(g._id)}
                    onChange={() => toggleGallery(g._id)}
                    className='accent-blush'
                  />
                  <label htmlFor={`gallery-${order._id}-${g._id}`} className='text-xs text-charcoal cursor-pointer'>
                    {tGallery(g.name)}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {error && <p className='text-xs text-red-500'>{error}</p>}
          <div className='flex items-center gap-2 pt-1'>
            <button
              onClick={save}
              disabled={saving}
              className='text-xs px-3 py-1 bg-blush text-charcoal rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer'
            >
              {saving ? t('admin.common.saving') : t('admin.common.done')}
            </button>
            <button
              onClick={() => { setIsEditing(false); setError(''); }}
              className='text-xs text-warm-gray hover:text-charcoal transition-colors cursor-pointer'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
