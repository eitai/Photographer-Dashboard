import Masonry from 'react-masonry-css';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { getImageUrl } from '@/lib/api';
import { Lightbox } from './Lightbox';
import { VirtualizedGalleryGrid } from './VirtualizedGalleryGrid';
import { GalleryImageCard } from './GalleryImageCard';
import { GallerySubmittedScreen } from './GallerySubmittedScreen';
import { GalleryActionBar } from './GalleryActionBar';
import { GalleryFolderNav } from './GalleryFolderNav';
import { GalleryVideoSection } from './GalleryVideoSection';
import { useSelectionGallery } from '@/hooks/useSelectionGallery';
import { useFolders } from '@/hooks/useFolders';
import { useIsMobile } from '@/hooks/use-mobile';
import type { GalleryData, GalleryImage } from '@/types/gallery';

interface Props {
  gallery: GalleryData;
  images: GalleryImage[];
  getImageUrl: (path: string) => string;
  filteredImageIds?: Set<string> | null;
}

export const SelectionGallery = ({ gallery, images, filteredImageIds }: Props) => {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const { folders } = useFolders(gallery._id);
  const hasFolders = folders.length > 0;

  const s = useSelectionGallery(gallery, images, filteredImageIds);

  const cardProps = (img: GalleryImage) => ({
    img,
    isSelected: s.selectedIds.has(img._id),
    isBlocked: s.selectionEnabled && !s.selectedIds.has(img._id) && s.atMax,
    selectionEnabled: s.selectionEnabled,
    heroId: s.heroId,
    activeCommentId: s.activeCommentId,
    imageComments: s.imageComments,
    getImageUrl,
    onToggleSelect: () => s.toggleSelect(img._id),
    onOpenLightbox: () => {},
    onToggleHero: () => s.setHeroId(s.heroId === img._id ? null : img._id),
    onToggleComment: () => s.setActiveCommentId(s.activeCommentId === img._id ? null : img._id),
    onCommentChange: (val: string) => s.setImageComments((prev) => ({ ...prev, [img._id]: val })),
    onCloseComment: () => s.setActiveCommentId(null),
    onClick: () => {
      if (s.activeCommentId) { s.setActiveCommentId(null); return; }
      if (!s.atMax || s.selectedIds.has(img._id)) s.toggleSelect(img._id);
    },
  });

  if (s.submitted) return <GallerySubmittedScreen />;

  const stickyTop = 109;

  return (
    <main className='flex-1' style={{ backgroundColor: 'var(--background)' }}>
      <section className='section-spacing'>
        <div className='container-narrow'>
          <FadeIn>
            <div className='text-center mb-8'>
              {gallery.clientName && (
                <p className='font-body text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3'>
                  {gallery.clientName}
                </p>
              )}
              <h1 className='font-display text-3xl md:text-[2.6rem] leading-tight text-foreground'>
                {gallery.headerMessage}
              </h1>
            </div>
          </FadeIn>

          <GalleryVideoSection videos={gallery.videos ?? []} getImageUrl={getImageUrl} />

          <GalleryActionBar
            selectedCount={s.selectedIds.size}
            maxSelections={gallery.maxSelections}
            hasLimit={s.hasLimit}
            atMax={s.atMax}
            selectionEnabled={s.selectionEnabled}
            isDownloadingAll={s.isDownloadingAll}
            downloadAllProgress={s.downloadAllProgress}
            isDownloading={s.isDownloading}
            downloadProgress={s.downloadProgress}
            onDownloadAll={s.handleDownloadAll}
            onDownloadSelected={s.handleDownloadSelected}
            onSubmit={s.handleSubmit}
          />

          {hasFolders && isMobile && (
            <GalleryFolderNav
              folders={folders}
              images={images}
              activeFolderId={s.activeFolderId}
              isMobile
              onSelectFolder={s.setActiveFolderId}
            />
          )}

          <div className={hasFolders && !isMobile ? 'flex gap-6 items-start' : ''}>
            {hasFolders && !isMobile && (
              <GalleryFolderNav
                folders={folders}
                images={images}
                activeFolderId={s.activeFolderId}
                isMobile={false}
                onSelectFolder={s.setActiveFolderId}
              />
            )}

            <div className='flex-1 min-w-0'>
              {s.isVirtualized ? (
                <VirtualizedGalleryGrid
                  images={s.visibleImages}
                  columnCount={s.columnCount}
                  rowHeight={220}
                  stickyTop={stickyTop}
                  renderItem={(img, i) => (
                    <GalleryImageCard
                      key={img._id}
                      fixedHeight
                      {...cardProps(img)}
                      onOpenLightbox={() => s.setLightboxIndex(i)}
                    />
                  )}
                />
              ) : (
                <Masonry
                  breakpointCols={{ default: 3, 640: 2 }}
                  className='masonry-grid'
                  columnClassName='masonry-grid_column'
                >
                  {s.visibleImages.map((img, i) => (
                    <FadeIn key={img._id} delay={Math.min(i * 0.03, 0.3)}>
                      <GalleryImageCard
                        {...cardProps(img)}
                        onOpenLightbox={() => s.setLightboxIndex(i)}
                      />
                    </FadeIn>
                  ))}
                </Masonry>
              )}

              {s.visibleImages.length === 0 && (
                <div className='text-center py-20'>
                  <p className='font-sans' style={{ color: 'var(--muted-foreground)' }}>{t('gallery.no_images')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {s.lightboxIndex !== null && (() => {
        const img = s.visibleImages[s.lightboxIndex];
        if (!img) return null;
        const isSelected = s.selectedIds.has(img._id);
        return (
          <Lightbox
            images={s.visibleImages}
            index={s.lightboxIndex}
            onClose={() => s.setLightboxIndex(null)}
            onPrev={() => s.setLightboxIndex((i) => (i! > 0 ? i! - 1 : i!))}
            onNext={() => s.setLightboxIndex((i) => (i! < s.visibleImages.length - 1 ? i! + 1 : i!))}
            getImageUrl={getImageUrl}
            onDownload={s.handleDownload}
            isSelected={isSelected}
            isBlocked={!isSelected && s.atMax}
            onToggleSelect={() => s.toggleSelect(img._id)}
            isHero={s.selectionEnabled ? s.heroId === img._id : undefined}
            onToggleHero={s.selectionEnabled ? () => s.setHeroId(s.heroId === img._id ? null : img._id) : undefined}
            comment={s.selectionEnabled ? s.imageComments[img._id] || '' : undefined}
            onCommentChange={s.selectionEnabled ? (val) => s.setImageComments((prev) => ({ ...prev, [img._id]: val })) : undefined}
          />
        );
      })()}
    </main>
  );
};
