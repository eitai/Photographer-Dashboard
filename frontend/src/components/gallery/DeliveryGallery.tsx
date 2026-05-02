import { useState } from 'react';
import { Download, Maximize2, Video, Images } from 'lucide-react';
import { downloadZip } from '@/lib/downloadZip';
import Masonry from 'react-masonry-css';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { Lightbox } from './Lightbox';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import type { GalleryData, GalleryImage } from '@/types/gallery';

interface Props {
  gallery: GalleryData;
  images: GalleryImage[];
  getImageUrl: (path: string) => string;
}

// Stagger container: drives staggered entrance of every grid card
const gridContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.1,
    },
  },
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export const DeliveryGallery = ({ gallery, images, getImageUrl }: Props) => {
  const { t } = useI18n();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [preparingZip, setPreparingZip] = useState(false);

  const handleDownload = async (path: string, filename: string) => {
    const res = await fetch(getImageUrl(path));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    setPreparingZip(true);
    const zipImages = images
      .filter((img) => img.path)
      .map((img) => ({
        _id: img.originalName || img.filename,
        path: img.path,
        filename: img.filename,
      }));
    await downloadZip(zipImages, 'photos', gallery.name);
    setPreparingZip(false);
  };

  const bannerImage = images[0];

  return (
    <main className='bg-background'>

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      {bannerImage && (
        <div className='relative w-full h-72 md:h-[26rem] overflow-hidden'>
          <img
            src={getImageUrl(bannerImage.previewPath ?? bannerImage.thumbnailPath ?? bannerImage.path)}
            alt={gallery.clientName || ''}
            className='w-full h-full object-cover'
          />

          {/* Bottom-heavy gradient so text is readable without burying the image */}
          <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent' />

          {/* Overlay text */}
          <div className='absolute inset-0 flex flex-col items-center justify-end pb-10 md:pb-14 px-4 text-center'>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
              className='font-sans text-white/70 text-xs md:text-sm tracking-[0.22em] uppercase mb-3'
            >
              {t('gallery.delivery_title')}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.45, ease: 'easeOut' }}
              className='font-serif text-white text-3xl md:text-5xl leading-tight drop-shadow-lg'
            >
              {gallery.clientName || gallery.name}
            </motion.h1>
          </div>
        </div>
      )}

      {/* ── Fallback header (no images at all) ──────────────────────────────── */}
      {!bannerImage && (
        <div className='text-center py-16 px-4'>
          <p className='font-sans text-muted-foreground text-xs tracking-[0.22em] uppercase mb-2'>
            {t('gallery.delivery_title')}
          </p>
          <h1 className='font-serif text-foreground text-3xl md:text-4xl'>
            {gallery.clientName || gallery.name}
          </h1>
        </div>
      )}

      {/* ── Photo count + Download All ──────────────────────────────────────── */}
      {images.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className='flex flex-col items-center gap-4 py-8 md:py-10'
        >
          {/* Subtle count line */}
          <p className='flex items-center gap-2 text-muted-foreground text-sm font-sans tracking-wide'>
            <Images size={14} className='text-primary' />
            <span>
              {images.length}&nbsp;{images.length === 1 ? 'photo' : 'photos'}&nbsp;ready for you
            </span>
          </p>

          {/* Download All — pill with a shimmer sweep on hover */}
          <button
            onClick={handleDownloadAll}
            disabled={preparingZip}
            className='group relative inline-flex items-center gap-2.5 px-8 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium tracking-wide overflow-hidden transition-all duration-300 hover:shadow-[0_4px_24px_0_color-mix(in_srgb,var(--primary)_45%,transparent)] hover:scale-[1.03] active:scale-100 disabled:opacity-60 disabled:pointer-events-none'
          >
            {/* Shine sweep */}
            <span
              aria-hidden='true'
              className='pointer-events-none absolute inset-0 translate-x-[-115%] skew-x-[-18deg] bg-white/20 transition-transform duration-500 group-hover:translate-x-[115%]'
            />
            <Download size={15} className='relative z-10 shrink-0' />
            <span className='relative z-10'>
              {preparingZip ? t('gallery.preparing_zip') : t('gallery.download_all')}
            </span>
          </button>
        </motion.div>
      )}

      <section className='section-spacing pt-2'>
        <div className='container-narrow'>

          {/* ── Videos ──────────────────────────────────────────────────────── */}
          {(gallery.videos ?? []).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className='mb-12 flex flex-wrap gap-5 justify-center'
            >
              {(gallery.videos ?? []).map((v) => (
                <div
                  key={v.filename}
                  className='rounded-2xl overflow-hidden border border-border bg-black w-full max-w-sm shadow-lg'
                >
                  <div className='flex items-center gap-2 px-4 py-3 bg-background/90 border-b border-border'>
                    <Video size={14} className='text-primary shrink-0' />
                    <span className='text-sm font-medium text-foreground truncate flex-1'>
                      {v.originalName || t('gallery.video_section')}
                    </span>
                    <a
                      href={getImageUrl(v.path)}
                      download={v.originalName || v.filename}
                      className='ms-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0'
                    >
                      <Download size={13} />
                      {t('gallery.download_video')}
                    </a>
                  </div>
                  <video src={getImageUrl(v.path)} controls className='w-full max-h-[25vh]' />
                </div>
              ))}
            </motion.div>
          )}

          {/* ── Image Grid ──────────────────────────────────────────────────── */}
          {images.length > 0 && (
            <motion.div
              variants={gridContainerVariants}
              initial='hidden'
              whileInView='visible'
              viewport={{ once: true, margin: '-80px' }}
            >
              <Masonry
                breakpointCols={{ default: 3, 1024: 3, 640: 2, 480: 1 }}
                className='masonry-grid !-mx-3'
                columnClassName='masonry-grid_column !px-3'
              >
                {images.map((img, i) => (
                  <motion.div
                    key={img._id}
                    variants={gridItemVariants}
                    // cap custom so item 50+ doesn't animate absurdly late
                    custom={Math.min(i, 20)}
                    className='group relative rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-shadow duration-300 mb-6'
                  >
                    {img.beforePath ? (
                      /* ── Before / After card ── */
                      <div className='aspect-[4/3] relative'>
                        <BeforeAfterSlider
                          beforeSrc={getImageUrl(img.beforePath)}
                          afterSrc={getImageUrl(img.thumbnailPath || img.path)}
                          alt={img.originalName || img.filename}
                        />
                        {/* Hover badge */}
                        <div className='absolute top-2 start-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none'>
                          <span className='text-[10px] font-semibold tracking-widest uppercase text-white bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full'>
                            Before / After
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* ── Standard photo card ── */
                      <div className='overflow-hidden rounded-2xl'>
                        <img
                          src={getImageUrl(img.thumbnailPath || img.previewPath || img.path)}
                          alt={img.originalName || img.filename}
                          className='w-full h-auto block transition-transform duration-500 group-hover:scale-[1.03]'
                          loading='lazy'
                        />
                      </div>
                    )}

                    {/* Overlay darkening on hover */}
                    <div className='absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-300 pointer-events-none rounded-2xl' />

                    {/* Expand — top-start */}
                    <button
                      onClick={() => setLightboxIndex(i)}
                      className='absolute top-3 start-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70'
                      aria-label='Expand image'
                    >
                      <Maximize2 size={13} />
                    </button>

                    {/* Download — top-end */}
                    {img.path && (
                      <button
                        onClick={() => handleDownload(img.path, img.filename)}
                        className='absolute top-3 end-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70'
                        aria-label={t('gallery.download_photo')}
                      >
                        <Download size={13} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </Masonry>
            </motion.div>
          )}

          {/* ── Empty state ──────────────────────────────────────────────────── */}
          <AnimatePresence>
            {images.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className='flex flex-col items-center justify-center py-24 gap-5'
              >
                <Images size={52} className='text-muted-foreground/35' strokeWidth={1} />
                <p className='text-muted-foreground text-center max-w-xs leading-relaxed'>
                  {t('gallery.no_images')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </section>

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i! > 0 ? i! - 1 : i!))}
          onNext={() => setLightboxIndex((i) => (i! < images.length - 1 ? i! + 1 : i!))}
          getImageUrl={getImageUrl}
          onDownload={handleDownload}
        />
      )}
    </main>
  );
};
