import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { getImageUrl } from '@/lib/api';
import { SectionHeading } from './photographerHomeComponents';
import type { PublicSettings } from './photographerHomeTypes';

interface LatestPost {
  _id: string;
  slug: string;
  title: string;
  featuredImagePath?: string;
  category?: string;
}

interface HomeSectionMediaProps {
  settings: PublicSettings | undefined;
  username: string;
  photographerName: string;
  showInstagramFeed: boolean;
  latestPosts: LatestPost[] | undefined;
}

export const HomeSectionMedia = ({
  settings,
  username,
  photographerName,
  showInstagramFeed,
  latestPosts,
}: HomeSectionMediaProps) => {
  const { t, lang } = useI18n();
  const isHe = lang === 'he';

  return (
    <>
      {settings?.featuredImages && settings.featuredImages.length > 0 && (
        <section className='py-20 px-6 bg-[#F8F8F8]'>
          <div className='max-w-5xl mx-auto'>
            <SectionHeading title={t('showcase.title')} />
            <div className='columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3 mt-14'>
              {settings.featuredImages.map((img, i) => (
                <FadeIn key={img._id} delay={i * 0.04}>
                  <div className='break-inside-avoid overflow-hidden group relative'>
                    <img
                      src={getImageUrl(img.thumbnailPath || img.path)}
                      alt={img.originalName || `${photographerName} photography showcase`}
                      className='w-full h-auto block transition-transform duration-300 group-hover:scale-[1.02]'
                      loading='lazy'
                    />
                    <div className='absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center'>
                      <span className='text-white text-sm font-sans opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                        {isHe ? 'צפה' : 'View'}
                      </span>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {showInstagramFeed && settings && (
        <section className='py-20 px-6 bg-white'>
          <div className='max-w-5xl mx-auto'>
            <SectionHeading title={t('instagram.feed.title')} />
            <div className='grid grid-cols-3 gap-2 sm:gap-3 mt-14'>
              {settings.instagramFeedImages.map((path, i) => (
                <FadeIn key={path} delay={i * 0.05}>
                  <a
                    href={settings.instagramHandle ? `https://instagram.com/${settings.instagramHandle.replace('@', '')}` : undefined}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='block aspect-square overflow-hidden bg-[#F0F0F0] relative group'
                  >
                    <img
                      src={getImageUrl(path)}
                      alt={`${photographerName} Instagram`}
                      className='w-full h-full object-cover hover:scale-105 transition-transform duration-300'
                      loading='lazy'
                    />
                    <div className='absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center'>
                      <span className='text-white text-xs font-sans uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                        Instagram
                      </span>
                    </div>
                  </a>
                </FadeIn>
              ))}
            </div>
            {settings.instagramHandle && (
              <FadeIn delay={0.3}>
                <div className='text-center mt-8'>
                  <a
                    href={`https://instagram.com/${settings.instagramHandle.replace('@', '')}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-2 px-6 py-3 border border-black text-black text-sm font-sans font-medium hover:bg-black hover:text-white transition-colors'
                  >
                    {t('instagram.feed.follow')}
                  </a>
                </div>
              </FadeIn>
            )}
          </div>
        </section>
      )}

      {latestPosts && latestPosts.length > 0 && (
        <section className='py-20 px-6 bg-[#F8F8F8]'>
          <div className='max-w-5xl mx-auto'>
            <FadeIn>
              <div className='flex items-end justify-between mb-14'>
                <h2 className='text-3xl md:text-4xl font-serif text-black'>{t('blog.preview.title')}</h2>
                <Link to={`/${username}/blog`} className='text-sm text-black underline hover:no-underline font-sans'>
                  {t('blog.preview.cta')} →
                </Link>
              </div>
            </FadeIn>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
              {latestPosts.map((post, i) => (
                <motion.div
                  key={post._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <Link to={`/${username}/blog/${post.slug}`} className='group block'>
                    {post.featuredImagePath ? (
                      <div className='aspect-[4/3] overflow-hidden mb-4 bg-[#F0F0F0]'>
                        <img
                          src={getImageUrl(post.featuredImagePath)}
                          alt={post.title}
                          className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-105'
                          loading='lazy'
                        />
                      </div>
                    ) : (
                      <div className='aspect-[4/3] mb-4 bg-[#F0F0F0]' />
                    )}
                    {post.category && (
                      <span className='text-xs text-black uppercase tracking-wider font-sans'>{post.category}</span>
                    )}
                    <h3 className='text-lg font-serif text-black mt-1 group-hover:text-black/60 transition-colors'>
                      {post.title}
                    </h3>
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
