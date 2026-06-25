import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { SectionHeading } from './photographerHomeComponents';
import type { PublicSettings } from './photographerHomeTypes';

interface HomeSectionPackagesProps {
  settings: PublicSettings;
  username: string;
}

export const HomeSectionPackages = ({ settings, username }: HomeSectionPackagesProps) => {
  const { t } = useI18n();

  return (
    <section className='py-20 px-6 bg-white'>
      <div className='max-w-5xl mx-auto'>
        <SectionHeading title={t('packages.title')} />
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 items-center'>
          {settings.packages.map((pkg, i) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className={`relative flex flex-col p-8 ${
                pkg.isHighlighted
                  ? 'bg-black text-white md:scale-105 shadow-2xl'
                  : 'bg-white border border-black/10 hover:-translate-y-1 hover:shadow-md transition-all duration-300'
              }`}
            >
              {pkg.isHighlighted && (
                <span className='absolute -top-3 start-1/2 -translate-x-1/2 text-xs font-medium bg-white text-black px-3 py-1 whitespace-nowrap font-sans'>
                  {t('packages.popular')}
                </span>
              )}
              <h3 className={`text-xl font-serif mb-2 ${pkg.isHighlighted ? 'text-white' : 'text-black'}`}>
                {pkg.name}
              </h3>
              <p className={`text-4xl font-bold font-serif mb-6 ${pkg.isHighlighted ? 'text-white' : 'text-black'}`}>
                {pkg.price}
              </p>
              {pkg.inclusions.length > 0 && (
                <ul className='flex-1 space-y-2 mb-6'>
                  {pkg.inclusions.map((item, idx) => (
                    <li
                      key={idx}
                      className={`flex items-start gap-2 text-sm ${
                        pkg.isHighlighted ? 'text-white/70' : 'text-[#666]'
                      } font-sans`}
                    >
                      <span className={`mt-0.5 ${pkg.isHighlighted ? 'text-white' : 'text-black'}`} aria-hidden='true'>
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to={`/${username}/contact`}
                className={`mt-auto inline-block text-center px-6 py-3 text-sm font-sans font-medium transition-colors rounded-none ${
                  pkg.isHighlighted
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'border border-black text-black hover:bg-black hover:text-white'
                }`}
              >
                {pkg.ctaLabel || t('packages.book_now')}
              </Link>
            </motion.div>
          ))}
        </div>
        {settings.packagesDisclaimer && (
          <FadeIn delay={0.2}>
            <p className='text-center text-xs text-[#666] mt-8 font-sans'>{settings.packagesDisclaimer}</p>
          </FadeIn>
        )}
      </div>
    </section>
  );
};
