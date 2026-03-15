import { useState, useEffect } from 'react';
import { Check, Send, Maximize2, Star, MessageCircle } from 'lucide-react';
import Masonry from 'react-masonry-css';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
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
    const saved = sessionStorage.getItem(`selections_${gallery._id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const SUBMITTED_KEY = `submitted_${gallery._id}`;
  const alreadySubmitted =
    localStorage.getItem(SUBMITTED_KEY) === 'true' ||
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

  const atMax = selectedIds.size >= gallery.maxSelections;

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
  const stickyTop = selectedIds.size > 0 ? 117 : 64; // 64px header + 53px selection bar

  const toggleSelect = (imageId: string) => {
    setSelectedIds((prev) => {
      if (!prev.has(imageId) && prev.size >= gallery.maxSelections) return prev;
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
          isSelected ? 'ring-4 shadow-lg' : ''
        } ${isBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        style={isSelected ? { boxShadow: '0 0 0 3px #E7B8B5', height: '100%' } : { height: '100%' }}
      >
        <img
          src={getImageUrl(img.thumbnailPath || img.path)}
          alt={img.originalName || img.filename}
          className='w-full h-full object-cover block'
          loading='lazy'
        />

        {!isBlocked && (
          <div className='absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-200 pointer-events-none' />
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

        {isSelected ? (
          <div className='absolute top-2 end-2 w-8 h-8 rounded-full flex items-center justify-center text-charcoal' style={{ backgroundColor: '#E7B8B5' }}>
            <Check size={14} />
          </div>
        ) : !isBlocked ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleSelect(img._id); }}
            className='absolute top-2 end-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
            aria-label={t('gallery.select_photo')}
          >
            <Check size={14} />
          </button>
        ) : null}

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
      <main className='pt-16 min-h-screen flex items-center justify-center'>
        <FadeIn>
          <div className='text-center px-6'>
            <p className='text-3xl text-foreground mb-4'>{t('gallery.thank_you')}</p>
            <p className='text-muted-foreground mb-8'>{t('gallery.review_choices')}</p>
            <button
              onClick={() => window.close()}
              className='px-5 py-2.5 rounded-lg border border-border text-muted-foreground text-sm hover:bg-muted transition-colors'
            >
              {t('gallery.close_window')}
            </button>
          </div>
        </FadeIn>
      </main>
    );
  }

  return (
    <main className='pt-16'>
      <section className='section-spacing'>
        <div className='container-narrow'>
          <FadeIn>
            <div className='text-center mb-12'>
              <p className=' text-2xl md:text-3xl text-foreground mb-2'>{gallery.headerMessage}</p>
              {gallery.clientName && <p className='text-muted-foreground'>{gallery.clientName}</p>}
              <p className='text-sm text-muted-foreground mt-2'>
                {selectedIds.size} {t('gallery.select_of')} {gallery.maxSelections} {t('gallery.images_selected')}
              </p>
            </div>
          </FadeIn>

          {selectedIds.size > 0 && (
            <div className='sticky top-16 z-40 bg-background/90 backdrop-blur-sm border-b border-border py-3 mb-8 -mx-6 px-6'>
              <div className='flex items-center justify-between max-w-[1100px] mx-auto'>
                <span className={`text-sm font-medium ${atMax ? 'text-[#E7B8B5]' : 'text-muted-foreground'}`}>
                  {selectedIds.size} / {gallery.maxSelections}
                  {atMax && <span className='ms-2 text-xs'>— {t('gallery.max_reached')}</span>}
                </span>
                <button
                  onClick={handleSubmit}
                  className='flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity'
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
                        isSelected ? 'ring-4 shadow-lg' : ''
                      } ${isBlocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      style={isSelected ? { boxShadow: '0 0 0 3px #E7B8B5' } : {}}
                    >
                      <img
                        src={getImageUrl(img.thumbnailPath || img.path)}
                        alt={img.originalName || img.filename}
                        className='w-full h-auto block'
                        loading='lazy'
                      />
                      {!isBlocked && (
                        <div className='absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-200 pointer-events-none' />
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
                      {isSelected ? (
                        <div
                          className='absolute top-2 end-2 w-8 h-8 rounded-full flex items-center justify-center text-charcoal'
                          style={{ backgroundColor: '#E7B8B5' }}
                        >
                          <Check size={14} />
                        </div>
                      ) : !isBlocked ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(img._id); }}
                          className='absolute top-2 end-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                          aria-label={t('gallery.select_photo')}
                        >
                          <Check size={14} />
                        </button>
                      ) : null}
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
              <p className='text-muted-foreground'>{t('gallery.no_images')}</p>
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
