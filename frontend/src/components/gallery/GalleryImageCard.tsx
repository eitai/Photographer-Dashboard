import { Maximize2, Star, MessageCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { GalleryImage } from '@/types/gallery';

interface Props {
  img: GalleryImage;
  isSelected: boolean;
  isBlocked: boolean;
  selectionEnabled: boolean;
  heroId: string | null;
  activeCommentId: string | null;
  imageComments: Record<string, string>;
  getImageUrl: (path: string) => string;
  /** Use true inside VirtualizedGalleryGrid (fixed-height rows), false for Masonry (natural height). */
  fixedHeight?: boolean;
  onToggleSelect: () => void;
  onOpenLightbox: () => void;
  onToggleHero: () => void;
  onToggleComment: () => void;
  onCommentChange: (val: string) => void;
  onCloseComment: () => void;
  onClick: () => void;
}

/** Amber selection heart — same affordance as the landing hero mini-gallery. */
function FlagHeart({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden='true'
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 ${
        active ? 'bg-flag text-white scale-100' : 'bg-white/85 text-muted-foreground scale-90'
      }`}
    >
      <svg className='w-3.5 h-3.5' viewBox='0 0 24 24' fill={active ? 'currentColor' : 'none'} stroke='currentColor' strokeWidth='2'>
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z'
        />
      </svg>
    </span>
  );
}

export function GalleryImageCard({
  img, isSelected, isBlocked, selectionEnabled, heroId, activeCommentId, imageComments,
  getImageUrl, fixedHeight = false,
  onToggleSelect, onOpenLightbox, onToggleHero, onToggleComment, onCommentChange, onCloseComment, onClick,
}: Props) {
  const { t } = useI18n();

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-lg overflow-hidden ${
        isBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      style={fixedHeight ? { height: '100%' } : {}}
    >
      <img
        src={getImageUrl(img.thumbnailPath || img.path)}
        alt={img.originalName || img.filename}
        className={`w-full object-cover block transition duration-300 ${fixedHeight ? 'h-full' : 'h-auto'} ${
          isBlocked ? '' : 'group-hover:scale-[1.04]'
        } ${isSelected ? '' : 'group-hover:opacity-90'}`}
        loading='lazy'
      />

      {/* Selection state — amber inset ring + soft ink tint (landing pattern) */}
      <span
        className={`absolute inset-0 rounded-lg transition-opacity duration-200 pointer-events-none ${
          isSelected ? 'bg-foreground/10 ring-2 ring-inset ring-flag' : 'bg-transparent'
        }`}
      />

      <button
        onClick={(e) => { e.stopPropagation(); onOpenLightbox(); }}
        className='absolute top-2 start-2 w-8 h-8 rounded-full bg-foreground/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200'
        aria-label={t('gallery.expand_image')}
      >
        <Maximize2 size={14} />
      </button>

      {/* Heart toggle — visible when selected; appears on hover/focus otherwise */}
      {selectionEnabled && !isBlocked && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          aria-pressed={isSelected}
          aria-label={t('gallery.select_photo')}
          className={`absolute top-2 end-2 transition-opacity duration-200 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag rounded-full ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <FlagHeart active={isSelected} />
        </button>
      )}

      {selectionEnabled && isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleHero(); }}
          className={`absolute bottom-2 start-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
            heroId === img._id
              ? 'bg-flag text-white opacity-100 shadow-md'
              : 'bg-foreground/40 text-white opacity-0 group-hover:opacity-100'
          }`}
          title={t('gallery.mark_hero')}
        >
          <Star size={12} fill={heroId === img._id ? 'currentColor' : 'none'} />
        </button>
      )}

      {selectionEnabled && isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComment(); }}
          className={`absolute bottom-2 end-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
            imageComments[img._id]?.trim()
              ? 'bg-flag text-white opacity-100'
              : 'bg-foreground/40 text-white opacity-0 group-hover:opacity-100'
          }`}
          title={t('gallery.add_note')}
        >
          <MessageCircle size={12} />
        </button>
      )}

      {activeCommentId === img._id && (
        <div
          className='absolute inset-x-0 bottom-0 p-2 bg-foreground/70 backdrop-blur-sm'
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <textarea
            autoFocus
            value={imageComments[img._id] || ''}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder={t('gallery.note_placeholder')}
            rows={2}
            className='w-full bg-white/10 text-white text-xs font-body placeholder-white/50 border border-white/20 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:border-white/40'
          />
          <button onClick={onCloseComment} className='mt-1 text-[10px] font-body text-white/70 hover:text-white'>
            {t('gallery.close_note')}
          </button>
        </div>
      )}
    </div>
  );
}
