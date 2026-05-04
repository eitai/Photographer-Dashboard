import { useState, useEffect } from 'react';
import { Check, Send, Maximize2, Star, MessageCircle, Video, Download } from 'lucide-react';

import Masonry from 'react-masonry-css';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import api, { getImageUrl } from '@/lib/api';
import { Lightbox } from './Lightbox';
import { VirtualizedGalleryGrid } from './VirtualizedGalleryGrid';
import type { GalleryData, GalleryImage } from '@/types/gallery';

interface Props {
  gallery: GalleryData;
  images: GalleryImage[];
  getImageUrl: (path: string) => string;
}

export const SelectionGallery = ({ gallery, images, getImageUrl }: Props) => {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // If admin reactivated, seed from the previous submission (authoritative source)
    if (gallery.previousSelectionIds?.length) {
      return new Set(gallery.previousSelectionIds);
    }
    const saved = sessionStorage.getItem(`selections_${gallery._id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const SUBMITTED_KEY = `submitted_${gallery._id}`;
  const alreadySubmitted =
    gallery.status === 'selection_submitted' ||
    gallery.status === 'in_editing' ||
    gallery.status === 'delivered';
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('gallery_session');
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem('gallery_session', id);
    return id;
  });

  const hasLimit = gallery.maxSelections > 0;
  const atMax = hasLimit && selectedIds.size >= gallery.maxSelections;

  const VIRTUALIZATION_THRESHOLD = 100;

  // Responsive column count
  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth < 640) return 2;
    if (window.innerWidth < 1024) return 3;
    return 4;
  });

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 640) setColumnCount(2);
      else if (window.innerWidth < 1024) setColumnCount(3);
      else setColumnCount(4);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isVirtualized = images.length > VIRTUALIZATION_THRESHOLD;
  const stickyTop = selectedIds.size > 0 ? 109 : 56; // 56px header + 53px selection bar

  const toggleSelect = (imageId: string) => {
    setSelectedIds((prev) => {
      if (!prev.has(imageId) && hasLimit && prev.size >= gallery.maxSelections) return prev;
      const next = new Set(prev);
      next.has(imageId) ? next.delete(imageId) : next.add(imageId);
      sessionStorage.setItem(`selections_${gallery._id}`, JSON.stringify([...next]));
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    const filteredComments = Object.fromEntries(Object.entries(imageComments).filter(([id, c]) => selectedIds.has(id) && c.trim()));
    await api.post(`/galleries/${gallery._id}/submit`, {
      sessionId,
      selectedImageIds: Array.from(selectedIds),
      imageComments: filteredComments,
      heroImageId: heroId && selectedIds.has(heroId) ? heroId : undefined,
    });
    localStorage.setItem(SUBMITTED_KEY, 'true');
    setSubmitted(true);
  };

  const handleDownload = (path: string, filename: string) => {
    const link = document.createElement('a');
    link.href = getImageUrl(path);
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderImageCard = (img: GalleryImage, i: number) => {
    const isSelected = selectedIds.has(img._id);
    const isBlocked = !isSelected && atMax;
    return (
      <div
        onClick={() => {
          if (activeCommentId) { setActiveCommentId(null); return; }
          if (!isBlocked) toggleSelect(img._id);
        }}
        className={`group relative rounded-xl overflow-hidden transition-shadow duration-200 ${
          isSelected ? 'shadow-lg' : ''
        } ${isBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        style={isSelected ? { boxShadow: '0 0 0 3px var(--primary)', height: '100%' } : { height: '100%' }}
      >
        <img
          src={getImageUrl(img.thumbnailPath || img.path)}
          alt={img.originalName || img.filename}
          className='w-full h-full object-cover block'
          loading='lazy'
        />

        {!isBlocked && (
          <div className='absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 pointer-events-none' />
        )}

        {!isBlocked && (
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
            className='absolute top-2 start-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
            aria-label='Expand image'
          >
            <Maximize2 size={14} />
          </button>
        )}

        {!isSelected && !isBlocked && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleSelect(img._id); }}
            className='absolute top-2 end-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
            aria-label={t('gallery.select_photo')}
          >
            <Check size={14} />
          </button>
        )}

        {isSelected && (
          <button
            onClick={(e) => { e.stopPropagation(); setHeroId(heroId === img._id ? null : img._id); }}
            className={`absolute bottom-2 start-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              heroId === img._id ? 'bg-amber-400 text-white opacity-100 shadow-md' : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'
            }`}
            title='Mark as hero photo'
          >
            <Star size={12} fill={heroId === img._id ? 'currentColor' : 'none'} />
          </button>
        )}

        {isSelected && (
          <button
            onClick={(e) => { e.stopPropagation(); setActiveCommentId(activeCommentId === img._id ? null : img._id); }}
            className={`absolute bottom-2 end-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              imageComments[img._id]?.trim() ? 'opacity-100 text-charcoal' : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'
            }`}
            style={imageComments[img._id]?.trim() ? { backgroundColor: '#E7B8B5' } : {}}
            title='Add note'
          >
            <MessageCircle size={12} />
          </button>
        )}

        {activeCommentId === img._id && (
          <div
            className='absolute inset-x-0 bottom-0 p-2 bg-black/70 backdrop-blur-sm'
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <textarea
              autoFocus
              value={imageComments[img._id] || ''}
              onChange={(e) => setImageComments((prev) => ({ ...prev, [img._id]: e.target.value }))}
              placeholder='הוסף הערה לתמונה...'
              rows={2}
              className='w-full bg-white/10 text-white text-xs placeholder-white/50 border border-white/20 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:border-white/40'
            />
            <button onClick={() => setActiveCommentId(null)} className='mt-1 text-[10px] text-white/70 hover:text-white'>
              סגור
            </button>
          </div>
        )}
      </div>
    );
  };

  if (submitted) {
    return (
      <main className='flex-1 flex items-center justify-center' style={{ backgroundColor: 'var(--background)' }}>
        <FadeIn>
          <div className='text-center px-6'>
            <p className='text-3xl mb-4' style={{ color: 'var(--foreground)' }}>{t('gallery.thank_you')}</p>
            <p className='mb-8' style={{ color: 'var(--muted-foreground)' }}>{t('gallery.review_choices')}</p>
            <button
              onClick={() => window.close()}
              className='px-5 py-2.5 rounded-xl text-sm font-sans transition-colors'
              style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'var(--background)' }}
            >
              {t('gallery.close_window')}
            </button>
          </div>
        </FadeIn>
      </main>
    );
  }

  return (
    <main className='flex-1' style={{ backgroundColor: 'var(--background)' }}>
      <section className='section-spacing'>
        <div className='container-narrow'>
          <FadeIn>
            <div className='text-center mb-12 max-w-[50%] mx-auto'>
              <p className='text-2xl md:text-3xl mb-2' style={{ color: 'var(--foreground)' }}>{gallery.headerMessage}</p>
              {gallery.clientName && <p className='font-sans' style={{ color: 'var(--muted-foreground)' }}>{gallery.clientName}</p>}
              <p className='text-sm font-sans mt-2' style={{ color: 'var(--muted-foreground)' }}>
                {hasLimit
                  ? `${selectedIds.size} ${t('gallery.select_of')} ${gallery.maxSelections} ${t('gallery.images_selected')}`
                  : `${selectedIds.size} ${t('gallery.images_selected')}`}
              </p>
            </div>
          </FadeIn>

          {(gallery.videos ?? []).length > 0 && (
            <FadeIn>
              <div className='mb-10 flex flex-wrap gap-4 justify-center'>
                {(gallery.videos ?? []).map((v) => (
                  <div key={v.filename} className='rounded-2xl overflow-hidden border border-beige bg-black w-full max-w-sm'>
                    <div className='flex items-center gap-2 px-4 py-3 border-b' style={{ backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)', borderBottomColor: 'var(--border)' }}>
                      <Video size={14} style={{ color: 'var(--muted-foreground)' }} />
                      <span className='text-sm font-sans font-medium truncate flex-1' style={{ color: 'var(--foreground)' }}>
                        {v.originalName || t('gallery.video_section')}
                      </span>
                      <a
                        href={getImageUrl(v.path)}
                        download={v.originalName || v.filename}
                        className='ms-auto flex items-center gap-1.5 text-xs font-sans transition-colors shrink-0' style={{ color: 'var(--muted-foreground)' }}
                      >
                        <Download size={13} />
                        {t('gallery.download_video')}
                      </a>
                    </div>
                    <video src={getImageUrl(v.path)} controls className='w-full max-h-[25vh]' />
                  </div>
                ))}
              </div>
            </FadeIn>
          )}

          {selectedIds.size > 0 && (
            <div className='sticky top-14 z-40 backdrop-blur-sm py-3 mb-8 -mx-6 px-6' style={{ backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)', borderBottom: '1px solid var(--border)' }}>
              <div className='flex items-center justify-between max-w-[1100px] mx-auto'>
                <span className='text-sm font-sans font-medium' style={{ color: atMax ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                  {hasLimit ? `${selectedIds.size} / ${gallery.maxSelections}` : selectedIds.size}
                  {atMax && <span className='ms-2 text-xs'>— {t('gallery.max_reached')}</span>}
                </span>
                <button
                  onClick={handleSubmit}
                  className='flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-sans font-medium transition-colors'
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <Send size={14} />
                  {t('gallery.send_selection')}
                </button>
              </div>
            </div>
          )}

          {isVirtualized ? (
            <VirtualizedGalleryGrid
              images={images}
              columnCount={columnCount}
              rowHeight={280}
              stickyTop={stickyTop}
              renderItem={renderImageCard}
            />
          ) : (
            <Masonry breakpointCols={{ default: 4, 1024: 3, 640: 2 }} className='masonry-grid' columnClassName='masonry-grid_column'>
              {images.map((img, i) => {
                const isSelected = selectedIds.has(img._id);
                const isBlocked = !isSelected && atMax;
                return (
                  <FadeIn key={img._id} delay={Math.min(i * 0.03, 0.3)}>
                    <div
                      onClick={() => {
                        if (activeCommentId) {
                          setActiveCommentId(null);
                          return;
                        }
                        if (!isBlocked) toggleSelect(img._id);
                      }}
                      className={`group relative rounded-xl overflow-hidden transition-shadow duration-200 ${
                        isSelected ? 'shadow-lg' : ''
                      } ${isBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      style={isSelected ? { boxShadow: '0 0 0 3px var(--primary)' } : {}}
                    >
                      <img
                        src={getImageUrl(img.thumbnailPath || img.path)}
                        alt={img.originalName || img.filename}
                        className='w-full h-auto block'
                        loading='lazy'
                      />
                      {!isBlocked && (
                        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 pointer-events-none' />
                      )}
                      {!isBlocked && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                          className='absolute top-2 start-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                          aria-label='Expand image'
                        >
                          <Maximize2 size={14} />
                        </button>
                      )}
                      {!isSelected && !isBlocked && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(img._id); }}
                          className='absolute top-2 end-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                          aria-label={t('gallery.select_photo')}
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {isSelected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setHeroId(heroId === img._id ? null : img._id); }}
                          className={`absolute bottom-2 start-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                            heroId === img._id
                              ? 'bg-amber-400 text-white opacity-100 shadow-md'
                              : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'
                          }`}
                          title='Mark as hero photo'
                        >
                          <Star size={12} fill={heroId === img._id ? 'currentColor' : 'none'} />
                        </button>
                      )}
                      {isSelected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveCommentId(activeCommentId === img._id ? null : img._id); }}
                          className={`absolute bottom-2 end-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                            imageComments[img._id]?.trim()
                              ? 'opacity-100 text-charcoal'
                              : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'
                          }`}
                          style={imageComments[img._id]?.trim() ? { backgroundColor: '#E7B8B5' } : {}}
                          title='Add note'
                        >
                          <MessageCircle size={12} />
                        </button>
                      )}
                      {activeCommentId === img._id && (
                        <div
                          className='absolute inset-x-0 bottom-0 p-2 bg-black/70 backdrop-blur-sm'
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <textarea
                            autoFocus
                            value={imageComments[img._id] || ''}
                            onChange={(e) => setImageComments((prev) => ({ ...prev, [img._id]: e.target.value }))}
                            placeholder='הוסף הערה לתמונה...'
                            rows={2}
                            className='w-full bg-white/10 text-white text-xs placeholder-white/50 border border-white/20 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:border-white/40'
                          />
                          <button onClick={() => setActiveCommentId(null)} className='mt-1 text-[10px] text-white/70 hover:text-white'>
                            סגור
                          </button>
                        </div>
                      )}
                    </div>
                  </FadeIn>
                );
              })}
            </Masonry>
          )}

          {images.length === 0 && (
            <div className='text-center py-20'>
              <p className='font-sans' style={{ color: 'var(--muted-foreground)' }}>{t('gallery.no_images')}</p>
            </div>
          )}
        </div>
      </section>

      {lightboxIndex !== null &&
        (() => {
          const img = images[lightboxIndex];
          const isSelected = selectedIds.has(img._id);
          const isBlocked = !isSelected && atMax;
          return (
            <Lightbox
              images={images}
              index={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onPrev={() => setLightboxIndex((i) => (i! > 0 ? i! - 1 : i!))}
              onNext={() => setLightboxIndex((i) => (i! < images.length - 1 ? i! + 1 : i!))}
              getImageUrl={getImageUrl}
              onDownload={handleDownload}
              isSelected={isSelected}
              isBlocked={isBlocked}
              onToggleSelect={() => toggleSelect(img._id)}
              isHero={heroId === img._id}
              onToggleHero={() => setHeroId(heroId === img._id ? null : img._id)}
              comment={imageComments[img._id] || ''}
              onCommentChange={(val) => setImageComments((prev) => ({ ...prev, [img._id]: val }))}
            />
          );
        })()}
    </main>
  );
};
