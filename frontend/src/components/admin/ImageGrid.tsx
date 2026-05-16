import { Maximize2, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getImageUrl, API_BASE } from '@/lib/api';
import { GalleryImage } from '@/types/admin';
import { UploadSkeletonGrid } from '@/components/admin/UploadSkeletonGrid';

interface Props {
  images: GalleryImage[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenLightbox: (index: number) => void;
  onRequestDelete: (id: string) => void;
  skeletonCount?: number;
}

export const ImageGrid = ({ images, selectedIds, onToggleSelect, onOpenLightbox, onRequestDelete, skeletonCount = 0 }: Props) => {
  const { t } = useI18n();

  return (
    <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2'>
      {images.map((img, idx) => {
        const isSelected = selectedIds.has(img._id);
        return (
          <div
            key={img._id}
            onClick={() => onToggleSelect(img._id)}
            className={`relative group aspect-square rounded-lg overflow-hidden bg-beige cursor-pointer transition-all ${
              isSelected ? 'ring-2 ring-blush ring-offset-1' : ''
            }`}
          >
            <img
              src={getImageUrl(img.thumbnailPath || img.path)}
              alt={img.originalName}
              className='w-full h-full object-cover'
              loading='lazy'
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                if (!el.dataset.fallback) {
                  el.dataset.fallback = '1';
                  const rawPath = img.thumbnailPath || img.path;
                  el.src = `${API_BASE}/api/media?k=${encodeURIComponent(rawPath)}`;
                }
              }}
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete(img._id);
              }}
              className='absolute top-1 end-1 bg-black/50 text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity'
              title={t('admin.upload.delete_title')}
            >
              <Trash2 size={11} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox(idx);
              }}
              className='absolute top-1 start-1 bg-black/50 text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity'
              title={t('admin.upload.open_title')}
            >
              <Maximize2 size={11} />
            </button>
          </div>
        );
      })}
      <UploadSkeletonGrid count={skeletonCount} />
    </div>
  );
};
