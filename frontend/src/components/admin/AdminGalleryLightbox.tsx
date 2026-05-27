import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getImageUrl } from '@/lib/api';
import { GalleryImage } from '@/types/admin';

interface Props {
  images: GalleryImage[];
  index: number;
  selectedIds: Set<string>;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleSelect: (id: string) => void;
}

export function AdminGalleryLightbox({ images, index, selectedIds, onClose, onPrev, onNext, onToggleSelect }: Props) {
  const { t, dir } = useI18n();
  const PrevIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const img = images[index];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  const isSelected = selectedIds.has(img._id);

  return (
    <div className='fixed inset-0 z-50 bg-black/90 flex items-center justify-center' onClick={onClose}>
      <button
        onClick={onClose}
        className='absolute top-4 end-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors'
      >
        <X size={18} />
      </button>

      <p className='absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm'>
        {index + 1} / {images.length}
      </p>

      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className='absolute start-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors'
        >
          <PrevIcon size={22} />
        </button>
      )}

      <img
        src={getImageUrl(img.path)}
        alt={img.originalName}
        className='max-w-full max-h-[90vh] rounded-xl object-contain px-2 sm:px-16'
        onClick={(e) => e.stopPropagation()}
      />

      {index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className='absolute end-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors'
        >
          <NextIcon size={22} />
        </button>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(img._id); }}
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-sm font-medium transition-colors ${
          isSelected ? 'bg-blush text-primary-foreground' : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        <Check size={14} />
        {isSelected ? t('admin.upload.selected_one') : t('admin.upload.select')}
      </button>
    </div>
  );
}
