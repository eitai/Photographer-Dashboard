import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePhotographer } from './PhotographerLayout';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import heroFallback from '@/assets/hero-family.jpg';
import aboutFallback from '@/assets/about-koral.jpg';
import { Phone } from 'lucide-react';

const InstagramIcon = () => (
  <svg viewBox='0 0 24 24' width='22' height='22' fill='currentColor'>
    <path d='M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z'/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox='0 0 24 24' width='22' height='22' fill='currentColor'>
    <path d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox='0 0 24 24' width='22' height='22' fill='currentColor'>
    <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/>
  </svg>
);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface PublicSettings {
  featuredImages: any[];
  bio: string;
  heroImagePath: string;
  profileImagePath: string;
  phone: string;
  instagramHandle: string;
  facebookUrl: string;
  heroSubtitle: string;
}

export const PhotographerHome = () => {
  const { t } = useI18n();
  const { username, photographer } = usePhotographer();
  const [latestPosts, setLatestPosts] = useState<any[]>([]);
  const [settings, setSettings] = useState<PublicSettings>({
    featuredImages: [],
    bio: '',
    heroImagePath: '',
    profileImagePath: '',
    phone: '',
    instagramHandle: '',
    facebookUrl: '',
    heroSubtitle: '',
  });

  useEffect(() => {
    api
      .get(`/p/${username}/blog`)
      .then((r) => setLatestPosts(r.data.slice(0, 3)))
      .catch(() => {});
    api
      .get(`/p/${username}/settings`)
      .then((r) => setSettings(r.data))
      .catch(() => {});
  }, [username]);

  const heroSrc = settings.heroImagePath ? `${API_BASE}${settings.heroImagePath}` : heroFallback;
  const profileSrc = settings.profileImagePath ? `${API_BASE}${settings.profileImagePath}` : aboutFallback;
  const bio = settings.bio || t('about.text');

  return (
    <main className='pt-16'>
      {/* Hero */}
      <section className='relative h-[85vh] min-h-[500px] flex items-center justify-center overflow-hidden'>
        <img src={heroSrc} alt='Photography' className='absolute inset-0 w-full h-full object-cover' />
        <div className='absolute inset-0 bg-background/30' />
        <div className='relative z-10 text-center px-4 sm:px-6 max-w-2xl w-full'>
          <FadeIn>
            <h1 className=' text-3xl sm:text-4xl md:text-6xl text-foreground mb-4 leading-tight'>
              {photographer.studioName || photographer.name}
            </h1>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className='text-lg md:text-2xl text-primary  mb-8'>{settings.heroSubtitle || t('hero.subtitle')}</p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <Link
                to={`/${username}/portfolio`}
                className='inline-block px-8 py-3 rounded-lg bg-primary text-primary-foreground font-sans text-sm font-medium hover:opacity-90 transition-opacity'
              >
                {t('hero.cta.gallery')}
              </Link>
              <Link
                to={`/${username}/contact`}
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
                <img src={profileSrc} alt={photographer.name} className='w-full h-full object-cover' />
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div>
                <h2 className=' text-3xl md:text-4xl text-foreground mb-6'>{t('about.title')}</h2>
                <p className='text-muted-foreground leading-relaxed text-base whitespace-pre-line'>{bio}</p>
                {(settings.phone || settings.instagramHandle || settings.facebookUrl) && (
                  <div className='flex items-center gap-1 mt-6'>
                    {settings.phone && (
                      <a
                        href={`tel:${settings.phone}`}
                        aria-label='Phone'
                        className='p-3 text-primary hover:text-primary/70 transition-colors rounded-md hover:bg-primary/10'
                      >
                        <Phone size={22} />
                      </a>
                    )}
                    {settings.phone && (
                      <a
                        href={`https://wa.me/${settings.phone.replace(/\D/g, '').replace(/^0/, '972')}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label='WhatsApp'
                        className='p-3 text-primary hover:text-primary/70 transition-colors rounded-md hover:bg-primary/10'
                      >
                        <WhatsAppIcon />
                      </a>
                    )}
                    {settings.instagramHandle && (
                      <a
                        href={`https://instagram.com/${settings.instagramHandle.replace('@', '')}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label='Instagram'
                        className='p-3 text-primary hover:text-primary/70 transition-colors rounded-md hover:bg-primary/10'
                      >
                        <InstagramIcon />
                      </a>
                    )}
                    {settings.facebookUrl && (
                      <a
                        href={settings.facebookUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label='Facebook'
                        className='p-3 text-primary hover:text-primary/70 transition-colors rounded-md hover:bg-primary/10'
                      >
                        <FacebookIcon />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Featured Images */}
      {settings.featuredImages.length > 0 && (
        <section className='section-spacing bg-card'>
          <div className='container-narrow'>
            <FadeIn>
              <h2 className=' text-3xl md:text-4xl text-center text-foreground mb-12'>{t('showcase.title')}</h2>
            </FadeIn>
            <div className='columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3'>
              {settings.featuredImages.map((img: any, i: number) => (
                <FadeIn key={img._id} delay={i * 0.04}>
                  <div className='break-inside-avoid rounded-xl overflow-hidden'>
                    <img
                      src={`${API_BASE}${img.thumbnailPath || img.path}`}
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
                <Link to={`/${username}/blog`} className='text-sm text-primary hover:underline'>
                  {t('blog.preview.cta')} →
                </Link>
              </div>
            </FadeIn>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
              {latestPosts.map((post, i) => (
                <FadeIn key={post._id} delay={i * 0.1}>
                  <Link to={`/${username}/blog/${post.slug}`} className='group block'>
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
    </main>
  );
};
