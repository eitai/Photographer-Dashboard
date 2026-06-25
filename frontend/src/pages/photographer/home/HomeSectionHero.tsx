import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { SocialLinks } from './photographerHomeComponents';
import type { PublicSettings } from './photographerHomeTypes';

interface Photographer {
  name: string;
  studioName?: string;
}

interface HomeSectionHeroProps {
  settings: PublicSettings | undefined;
  photographer: Photographer;
  username: string;
  heroSrc: string | null;
  heroImgLoaded: boolean;
  setHeroImgLoaded: (v: boolean) => void;
  showVideo: boolean;
  embedUrl: string | null;
  videoActive: boolean;
  setVideoActive: (v: boolean) => void;
}

export const HomeSectionHero = ({
  settings,
  photographer,
  username,
  heroSrc,
  heroImgLoaded,
  setHeroImgLoaded,
  showVideo,
  embedUrl,
  videoActive,
  setVideoActive,
}: HomeSectionHeroProps) => {
  const { t, lang } = useI18n();
  const isHe = lang === 'he';

  return (
    <section className='min-h-screen bg-white flex items-center px-6 md:px-12 lg:px-20'>
      <div className='max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16'>

        <div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className='text-xs uppercase tracking-[0.3em] text-black/40 mb-6 font-sans'
          >
            {settings?.heroTagline || (isHe ? 'צלם מקצועי · אירועים ומשפחות' : 'Professional Photography · Events & Families')}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className='text-5xl md:text-6xl xl:text-7xl font-serif text-black leading-[1.05] tracking-tight mb-6'
          >
            {photographer.studioName || photographer.name}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className='text-lg text-[#666666] mb-10 max-w-md font-sans leading-relaxed'
          >
            {settings?.heroSubtitle || t('hero.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className='flex flex-wrap gap-3'
          >
            <Link
              to={`/${username}/portfolio`}
              className='px-8 py-3.5 bg-black text-white text-sm font-sans font-medium hover:bg-black/80 transition-colors rounded-none'
            >
              {settings?.heroCtaPrimaryLabel || t('hero.cta.gallery')}
            </Link>
            <Link
              to={`/${username}/contact`}
              className='px-8 py-3.5 border border-black text-black text-sm font-sans font-medium hover:bg-black hover:text-white transition-colors rounded-none'
            >
              {settings?.heroCtaSecondaryLabel || t('hero.cta.book')}
            </Link>
          </motion.div>

          {(settings?.phone || settings?.instagramHandle) && settings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className='flex items-center gap-1 mt-10 pt-10 border-t border-black/10'
            >
              <SocialLinks settings={settings} />
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className='relative'
        >
          {showVideo && embedUrl ? (
            <div className='relative aspect-video bg-black overflow-hidden shadow-2xl'>
              {videoActive ? (
                <iframe
                  src={`${embedUrl}?autoplay=1`}
                  title='Video reel'
                  allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                  allowFullScreen
                  className='w-full h-full border-0'
                  loading='lazy'
                />
              ) : (
                <div className='relative w-full h-full'>
                  {heroSrc && (
                    <img
                      src={heroSrc}
                      alt='Photography'
                      onLoad={() => setHeroImgLoaded(true)}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${heroImgLoaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                  )}
                  <div className='absolute inset-0 bg-black/20' />
                  <button
                    onClick={() => setVideoActive(true)}
                    className='absolute inset-0 flex items-center justify-center group'
                    aria-label='Play video'
                    type='button'
                  >
                    <span className='w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform'>
                      <Play size={28} className='text-black ms-1' fill='currentColor' />
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className='relative aspect-[4/5] overflow-hidden shadow-2xl'>
              {heroSrc ? (
                <img
                  src={heroSrc}
                  alt='Photography'
                  onLoad={() => setHeroImgLoaded(true)}
                  className={`w-full h-full object-cover transition-opacity duration-700 ${heroImgLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              ) : (
                <div className='w-full h-full bg-[#F0F0F0]' />
              )}
            </div>
          )}

          <div className='absolute -top-3 -start-3 w-12 h-12 border-t-2 border-s-2 border-black pointer-events-none' />
          <div className='absolute -bottom-3 -end-3 w-12 h-12 border-b-2 border-e-2 border-black pointer-events-none' />
        </motion.div>
      </div>
    </section>
  );
};
