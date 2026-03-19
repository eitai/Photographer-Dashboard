import { useState } from 'react';
import axios from 'axios';
import { Download, Maximize2, Video } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import JSZip from 'jszip';
import Masonry from 'react-masonry-css';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { Lightbox } from './Lightbox';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import type { GalleryData, GalleryImage } from '@/types/gallery';

interface Props {
  gallery: GalleryData;
  images: GalleryImage[];
  getImageUrl: (path: string) => string;
}

export const DeliveryGallery = ({ gallery, images, getImageUrl }: Props) => {
  const { t } = useI18n();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [preparingZip, setPreparingZip] = useState(false);

  const handleDownload = (path: string, filename: string) => {
    const link = document.createElement('a');
    link.href = getImageUrl(path);
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    setPreparingZip(true);
    const zip = new JSZip();
    const folder = zip.folder('photos')!;
    await Promise.all(
      images.map(async (img) => {
        const res = await axios.get(getImageUrl(img.path), { responseType: 'blob' });
        folder.file(img.filename, res.data);
      }),
    );
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${gallery.name}.zip`;
    a.click();
    setPreparingZip(false);
  };

  return (
    <main className='pt-16'>
      <section className='section-spacing'>
        <div className='container-narrow'>
          <FadeIn>
            <div className='text-center mb-10'>
              <p className=' text-2xl md:text-3xl text-foreground mb-2'>{gallery.headerMessage || t('gallery.delivery_title')}</p>
              {gallery.clientName && <p className='text-muted-foreground'>{gallery.clientName}</p>}
              {images.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  disabled={preparingZip}
                  className='mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60'
                >
                  <Download size={15} />
                  {preparingZip ? t('gallery.preparing_zip') : t('gallery.download_all')}
                </button>
              )}
            </div>
          </FadeIn>

          {(gallery.videos ?? []).length > 0 && (
            <FadeIn>
              <div className='mb-10 space-y-4'>
                {(gallery.videos ?? []).map((v) => (
                  <div key={v.filename} className='rounded-2xl overflow-hidden border border-border bg-black'>
                    <div className='flex items-center gap-2 px-4 py-3 bg-background/90 border-b border-border'>
                      <Video size={14} className='text-muted-foreground' />
                      <span className='text-sm font-medium text-foreground truncate flex-1'>
                        {v.originalName || t('gallery.video_section')}
                      </span>
                      <a
                        href={`${API_BASE}${v.path}`}
                        download={v.originalName || v.filename}
                        className='ms-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0'
                      >
                        <Download size={13} />
                        {t('gallery.download_video')}
                      </a>
                    </div>
                    <video src={`${API_BASE}${v.path}`} controls className='w-full max-h-[70vh]' />
                  </div>
                ))}
              </div>
            </FadeIn>
          )}

          <Masonry breakpointCols={{ default: 4, 1024: 3, 640: 2 }} className='masonry-grid' columnClassName='masonry-grid_column'>
            {images.map((img, i) => (
              <FadeIn key={img._id} delay={Math.min(i * 0.03, 0.3)}>
                <div className='group relative rounded-xl overflow-hidden cursor-pointer'>
                  {img.beforePath ? (
                    <div className='aspect-[4/3]'>
                      <BeforeAfterSlider
                        beforeSrc={getImageUrl(img.beforePath)}
                        afterSrc={getImageUrl(img.thumbnailPath || img.path)}
                        alt={img.originalName || img.filename}
                      />
                    </div>
                  ) : (
                    <img
                      src={getImageUrl(img.thumbnailPath || img.path)}
                      alt={img.originalName || img.filename}
                      className='w-full h-auto block'
                      loading='lazy'
                    />
                  )}
                  <div className='absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors duration-200 pointer-events-none' />

                  <button
                    onClick={() => setLightboxIndex(i)}
                    className='absolute top-2 start-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                    aria-label='Expand image'
                  >
                    <Maximize2 size={14} />
                  </button>

                  <button
                    onClick={() => handleDownload(img.path, img.filename)}
                    className='absolute top-2 end-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'
                    aria-label={t('gallery.download_photo')}
                  >
                    <Download size={14} />
                  </button>
                </div>
              </FadeIn>
            ))}
          </Masonry>

          {images.length === 0 && (
            <div className='text-center py-20'>
              <p className='text-muted-foreground'>{t('gallery.no_images')}</p>
            </div>
          )}
        </div>
      </section>

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
