import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { getImageUrl } from '@/lib/api';
import type { PublicSettings } from './photographerHomeTypes';

interface HomeSectionCtaBlocksProps {
  settings: PublicSettings;
  username: string;
  showCtaBanner: boolean;
}

export const HomeSectionCtaBlocks = ({ settings, username, showCtaBanner }: HomeSectionCtaBlocksProps) => {
  const { t, lang } = useI18n();
  const isHe = lang === 'he';

  return (
    <>
      {showCtaBanner && (
        <FadeIn>
          <section
            className='relative py-20 px-6 bg-cover bg-center overflow-hidden'
            style={settings.ctaBannerImagePath ? { backgroundImage: `url(${getImageUrl(settings.ctaBannerImagePath)})` } : undefined}
          >
            <div className={`absolute inset-0 ${settings.ctaBannerImagePath ? 'bg-black/50' : 'bg-black'}`} />
            <div className='relative z-10 max-w-5xl mx-auto text-center'>
              <h2 className='text-3xl md:text-5xl font-serif text-white mb-4'>
                {settings.ctaBannerHeading}
              </h2>
              {settings.ctaBannerSubtext && (
                <p className='text-white/70 text-lg mb-8 max-w-xl mx-auto font-sans'>
                  {settings.ctaBannerSubtext}
                </p>
              )}
              <Link
                to={`/${username}/contact`}
                className='inline-block px-8 py-3 text-sm font-sans font-medium transition-colors rounded-none bg-white text-black hover:bg-white/90'
              >
                {settings.ctaBannerButtonLabel || t('hero.cta.book')}
              </Link>
            </div>
          </section>
        </FadeIn>
      )}

      <section className='relative bg-black py-28 px-6 overflow-hidden'>
        <div
          className='absolute inset-0 pointer-events-none opacity-[0.03]'
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className='relative z-10 max-w-4xl mx-auto text-center'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            <p className='text-white/40 text-xs uppercase tracking-[0.4em] mb-8 font-sans'>
              {isHe ? 'צרו קשר' : 'Get In Touch'}
            </p>
            <h2 className='text-5xl md:text-7xl font-serif text-white leading-tight mb-6'>
              {settings.finalCtaHeading || (isHe ? 'מוכנים לצלם?' : 'Ready to Shoot?')}
            </h2>
            <p className='text-white/50 text-lg mb-12 font-sans max-w-md mx-auto'>
              {settings.finalCtaSubtext || (isHe
                ? 'צרו קשר היום ונתאים יחד את הצילום המושלם עבורכם'
                : 'Contact us and we will plan the perfect shoot together')}
            </p>
            <a
              href='#contact'
              className='inline-block px-12 py-4 bg-white text-black text-sm font-sans font-semibold hover:bg-white/90 transition-colors rounded-none'
            >
              {settings.finalCtaButtonLabel || (isHe ? 'שלח הודעה' : 'Send a Message')}
            </a>
          </motion.div>
        </div>
      </section>
    </>
  );
};
