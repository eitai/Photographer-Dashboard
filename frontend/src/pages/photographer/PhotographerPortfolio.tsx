import { useEffect, useState } from 'react';
import { usePhotographer } from './PhotographerLayout';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import Masonry from 'react-masonry-css';
import { Lightbox, type LightboxImage } from '@/components/gallery/Lightbox';
import api from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const PhotographerPortfolio = () => {
  const { t } = useI18n();
  const { username } = usePhotographer();
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    api
      .get(`/p/${username}/settings`)
      .then((r) => setImages(r.data.featuredImages || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  const getImageUrl = (path: string) => `${API_BASE}${path}`;

  return (
    <main className='pt-16'>
      <section className='section-spacing'>
        <div className='container-narrow'>
          <FadeIn>
            <h1 className=' text-4xl md:text-5xl text-center text-foreground mb-12'>{t('portfolio.title')}</h1>
          </FadeIn>

          {loading && (
            <div className='flex justify-center py-20'>
              <div className='w-7 h-7 rounded-full border-2 border-beige border-t-blush animate-spin' />
            </div>
          )}

          {!loading && images.length === 0 && (
            <div className='text-center py-20'>
              <p className='text-muted-foreground'>{t('gallery.no_images')}</p>
            </div>
          )}

          {!loading && images.length > 0 && (
            <Masonry
              breakpointCols={{ default: 3, 1024: 3, 640: 2, 480: 1 }}
              className='masonry-grid'
              columnClassName='masonry-grid_column'
            >
              {images.map((img, i) => (
                <FadeIn key={img._id} delay={Math.min(i * 0.04, 0.4)}>
                  <button onClick={() => setLightboxIndex(i)} className='group relative block w-full rounded-xl overflow-hidden'>
                    <img
                      src={getImageUrl(img.thumbnailPath || img.path)}
                      alt={img.originalName || img.filename || ''}
                      className='w-full h-auto block transition-transform duration-300 group-hover:scale-[1.02]'
                      loading='lazy'
                      decoding='async'
                    />
                    <div className='absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 pointer-events-none' />
                  </button>
                </FadeIn>
              ))}
            </Masonry>
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
          showDownload={false}
        />
      )}
    </main>
  );
};
