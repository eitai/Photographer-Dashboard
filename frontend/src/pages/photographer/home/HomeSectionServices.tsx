import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { SectionHeading, ServiceIcon, AnimatedNumber, ICON_MAP } from './photographerHomeComponents';
import { Camera } from 'lucide-react';
import type { PublicSettings, PromiseItem, StatItem } from './photographerHomeTypes';

interface HomeSectionServicesProps {
  settings: PublicSettings;
  username: string;
  showServices: boolean;
  activeStats: StatItem[];
  activePromises: PromiseItem[];
}

export const HomeSectionServices = ({
  settings,
  username,
  showServices,
  activeStats,
  activePromises,
}: HomeSectionServicesProps) => {
  const { t, lang } = useI18n();
  const isHe = lang === 'he';

  return (
    <>
      {activeStats.length > 0 && (
        <section className='border-y border-black/10 py-12 px-6'>
          <div className='max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center'>
            {activeStats.map((stat, i) => (
              <motion.div
                key={stat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                <p className='text-sm text-[#666] uppercase tracking-wider mt-2 font-sans'>{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {activePromises.length > 0 && (
        <section className='py-20 px-6 bg-white'>
          <div className='max-w-5xl mx-auto'>
            <SectionHeading title={isHe ? 'למה לבחור בנו' : 'Why Choose Us'} />
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-14'>
              {activePromises.map((p, i) => {
                const PromiseIcon = ICON_MAP[p.icon] || Camera;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.5 }}
                    className='relative p-6 border border-black/[0.08] bg-white hover:-translate-y-1 hover:shadow-md transition-all duration-300 overflow-hidden'
                  >
                    <span className='absolute top-3 end-4 text-[56px] font-bold font-serif text-black/[0.04] leading-none select-none'>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <PromiseIcon size={24} className='text-black mb-4' />
                    <h3 className='font-serif text-lg text-black mb-2'>{p.title}</h3>
                    <p className='text-sm text-[#666] leading-relaxed font-sans'>{p.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {showServices && (
        <section className='py-20 px-6 bg-white'>
          <div className='max-w-5xl mx-auto'>
            <SectionHeading title={t('services.title')} />
            <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-14'>
              {settings.services.map((service, i) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.5 }}
                  className='bg-white border border-black/[0.08] p-6 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300'
                >
                  <ServiceIcon name={service.icon} />
                  <h3 className='text-lg font-serif text-black'>{service.title}</h3>
                  <p className='text-[#666] text-sm leading-relaxed flex-1 font-sans'>{service.description}</p>
                  {service.startingPrice && (
                    <span className='inline-block text-xs font-medium text-black bg-black/5 px-3 py-1 self-start font-sans'>
                      {t('services.starting_from')}{service.startingPrice}
                    </span>
                  )}
                  <Link
                    to={`/${username}/contact`}
                    className='mt-auto text-sm text-black underline hover:no-underline font-sans'
                  >
                    {t('services.book_session')} →
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};
