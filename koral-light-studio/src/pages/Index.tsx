import { useI18n } from '@/lib/i18n';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { FadeIn } from '@/components/FadeIn';
import api from '@/lib/api';
import heroImage from '@/assets/hero-family.jpg';
import aboutImage from '@/assets/about-koral.jpg';
import familiesImg from '@/assets/portfolio-families.jpg';
import maternityImg from '@/assets/portfolio-maternity.jpg';
import newbornImg from '@/assets/portfolio-newborn.jpg';
import brandingImg from '@/assets/portfolio-branding.jpg';
import landscapeImg from '@/assets/portfolio-landscape.jpg';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const Index = () => {
  const { t } = useI18n();
  const [latestPosts, setLatestPosts] = useState<any[]>([]);
  const [featuredImages, setFeaturedImages] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get('/blog');
        setLatestPosts(r.data.slice(0, 3));
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  useEffect(() => {
    api
      .get('/settings')
      .then((r) => setFeaturedImages(r.data.featuredImages || []))
      .catch((err) => console.error('Failed to load featured images:', err));
  }, []);

  const categories = [
    { key: 'families', img: familiesImg },
    { key: 'maternity', img: maternityImg },
    { key: 'newborn', img: newbornImg },
    { key: 'branding', img: brandingImg },
    { key: 'landscape', img: landscapeImg },
  ];

  const testimonials = [1, 2, 3];

  return (
    <main className='pt-16'>
      {/* Hero */}
      <section className='relative h-[85vh] min-h-[500px] flex items-center justify-center overflow-hidden'>
        <img src={heroImage} alt='Family photography in natural light' className='absolute inset-0 w-full h-full object-cover' />
        <div className='absolute inset-0 bg-background/30' />
        <div className='relative z-10 text-center px-6 max-w-2xl'>
          <FadeIn>
            <h1 className=' text-4xl md:text-6xl text-foreground mb-4 leading-tight'>{t('hero.title')}</h1>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className='text-base md:text-lg text-foreground/80 mb-8'>{t('hero.subtitle')}</p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <Link
                to='/portfolio'
                className='inline-block px-8 py-3 rounded-lg bg-primary text-primary-foreground font-sans text-sm font-medium hover:opacity-90 transition-opacity'
              >
                {t('hero.cta.gallery')}
              </Link>
              <Link
                to='/contact'
                className='inline-block px-8 py-3 rounded-lg border border-foreground/30 text-foreground font-sans text-sm font-medium hover:bg-foreground/5 transition-colors'
              >
                {t('hero.cta.book')}
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* About */}
      <section className='section-spacing'>
        <div className='container-narrow'>
          <div className='grid md:grid-cols-2 gap-12 md:gap-16 items-center'>
            <FadeIn>
              <div className='aspect-[3/4] rounded-xl overflow-hidden'>
                <img src={aboutImage} alt='Koral - photographer' className='w-full h-full object-cover' />
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div>
                <h2 className=' text-3xl md:text-4xl text-foreground mb-6'>{t('about.title')}</h2>
                <p className='text-muted-foreground leading-relaxed text-base'>{t('about.text')}</p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Portfolio Preview */}
      <section className='section-spacing bg-card'>
        <div className='container-narrow'>
          <FadeIn>
            <h2 className=' text-3xl md:text-4xl text-center text-foreground mb-12'>{t('portfolio.title')}</h2>
          </FadeIn>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
            {categories.map((cat, i) => (
              <FadeIn key={cat.key} delay={i * 0.08}>
                <Link to='/portfolio' className='group relative aspect-square rounded-xl overflow-hidden block'>
                  <img
                    src={cat.img}
                    alt={t(`portfolio.${cat.key}`)}
                    className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
                    loading='lazy'
                  />
                  <div className='absolute inset-0 bg-foreground/10 group-hover:bg-foreground/20 transition-colors duration-300' />
                  <div className='absolute bottom-0 inset-x-0 p-4'>
                    <span className=' text-lg text-background drop-shadow-md'>{t(`portfolio.${cat.key}`)}</span>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Featured / Showcase */}
      {featuredImages.length > 0 && (
        <section className='section-spacing'>
          <div className='container-narrow'>
            <FadeIn>
              <h2 className=' text-3xl md:text-4xl text-center text-foreground mb-12'>{t('showcase.title')}</h2>
            </FadeIn>
            <div className='columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3'>
              {featuredImages.map((img: any, i: number) => (
                <FadeIn key={img._id} delay={i * 0.04}>
                  <div className='break-inside-avoid rounded-xl overflow-hidden'>
                    <img
                      src={`${API_BASE}${img.path}`}
                      alt=''
                      className='w-full h-auto block hover:scale-[1.02] transition-transform duration-300'
                      loading='lazy'
                    />
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Blog Preview */}
      {latestPosts.length > 0 && (
        <section className='section-spacing'>
          <div className='container-narrow'>
            <FadeIn>
              <div className='flex items-end justify-between mb-10'>
                <h2 className=' text-3xl md:text-4xl text-foreground'>{t('blog.preview.title')}</h2>
                <Link to='/blog' className='text-sm text-primary hover:underline'>
                  {t('blog.preview.cta')} →
                </Link>
              </div>
            </FadeIn>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
              {latestPosts.map((post, i) => (
                <FadeIn key={post._id} delay={i * 0.1}>
                  <Link to={`/blog/${post.slug}`} className='group block'>
                    {post.featuredImagePath ? (
                      <div className='aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-secondary'>
                        <img
                          src={`${API_BASE}${post.featuredImagePath}`}
                          alt={post.title}
                          className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-105'
                          loading='lazy'
                        />
                      </div>
                    ) : (
                      <div className='aspect-[4/3] rounded-xl mb-4 bg-secondary' />
                    )}
                    {post.category && <span className='text-xs text-primary uppercase tracking-wider'>{post.category}</span>}
                    <h3 className=' text-lg text-foreground mt-1 group-hover:text-primary transition-colors'>{post.title}</h3>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className='section-spacing'>
        <div className='container-narrow'>
          <FadeIn>
            <h2 className=' text-3xl md:text-4xl text-center text-foreground mb-12'>{t('testimonials.title')}</h2>
          </FadeIn>
          <div className='grid md:grid-cols-3 gap-8'>
            {testimonials.map((num) => (
              <FadeIn key={num} delay={num * 0.1}>
                <div className='bg-card rounded-xl p-8 border border-border'>
                  <p className='text-muted-foreground italic mb-4 leading-relaxed'>"{t(`testimonial.${num}.text`)}"</p>
                  <p className='text-sm font-medium text-foreground'>— {t(`testimonial.${num}.name`)}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};
