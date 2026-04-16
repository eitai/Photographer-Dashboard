import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePhotographer } from './PhotographerLayout';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import api, { getImageUrl } from '@/lib/api';
import heroFallback from '@/assets/hero-family.jpg';
import aboutFallback from '@/assets/about-koral.jpg';
import { Phone, Camera, Heart, Users, Star, Baby, Diamond, Building2, Mountain, Play } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

// ── Social icons ─────────────────────────────────────────────────────────────

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

const TikTokIcon = () => (
  <svg viewBox='0 0 24 24' width='22' height='22' fill='currentColor'>
    <path d='M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.73a4.85 4.85 0 01-1-.04z'/>
  </svg>
);

// ── Lucide icon lookup for services ─────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  camera: Camera,
  heart: Heart,
  users: Users,
  star: Star,
  baby: Baby,
  diamond: Diamond,
  'building-2': Building2,
  mountain: Mountain,
};

const ServiceIcon = ({ name }: { name: string }) => {
  const Icon = ICON_MAP[name] || Camera;
  return <Icon size={28} className='text-primary' />;
};

// ── Video embed helper ───────────────────────────────────────────────────────

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video${u.pathname}`;
    return null;
  } catch {
    return null;
  }
}

// ── Star rating row ──────────────────────────────────────────────────────────

const StarRating = ({ rating }: { rating: number }) => (
  <div className='flex gap-0.5' aria-label={`${rating} out of 5 stars`}>
    {Array.from({ length: 5 }, (_, i) =>
      i < rating ? (
        <Star key={i} size={14} className='text-primary fill-primary' />
      ) : (
        <Star key={i} size={14} className='text-muted-foreground/40' />
      )
    )}
  </div>
);

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  startingPrice: string | null;
  sessionTypeValue: string | null;
}

interface TestimonialItem {
  id: string;
  text: string;
  clientName: string;
  sessionType: string | null;
  rating: number | null;
}

interface PackageItem {
  id: string;
  name: string;
  price: string;
  inclusions: string[];
  isHighlighted: boolean;
  ctaLabel: string | null;
}

interface PublicSettings {
  featuredImages: any[];
  bio: string;
  heroImagePath: string;
  profileImagePath: string;
  phone: string;
  instagramHandle: string;
  facebookUrl: string;
  tiktokUrl: string;
  heroSubtitle: string;
  heroOverlayOpacity: 'light' | 'medium' | 'dark';
  heroCtaPrimaryLabel: string;
  heroCtaSecondaryLabel: string;
  aboutSectionTitle: string;
  servicesEnabled: boolean;
  services: ServiceItem[];
  testimonialsEnabled: boolean;
  testimonials: TestimonialItem[];
  packagesEnabled: boolean;
  packagesDisclaimer: string;
  packages: PackageItem[];
  videoSectionEnabled: boolean;
  videoUrl: string;
  videoSectionHeading: string;
  videoSectionSubheading: string;
  ctaBannerEnabled: boolean;
  ctaBannerHeading: string;
  ctaBannerSubtext: string;
  ctaBannerButtonLabel: string;
  instagramFeedEnabled: boolean;
  instagramFeedImages: string[];
}

const OVERLAY_CLASS: Record<'light' | 'medium' | 'dark', string> = {
  light: 'bg-background/10',
  medium: 'bg-background/30',
  dark: 'bg-background/60',
};

// ── Component ────────────────────────────────────────────────────────────────

export const PhotographerHome = () => {
  const { t } = useI18n();
  const { username, photographer } = usePhotographer();
  const [videoActive, setVideoActive] = useState(false);

  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ['photographerSettings', username],
    queryFn: () => api.get(`/p/${username}/settings`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: latestPosts } = useQuery<any[]>({
    queryKey: ['photographerBlog', username],
    queryFn: () => api.get(`/p/${username}/blog`).then((r) => r.data.slice(0, 3)),
    staleTime: 5 * 60 * 1000,
  });

  const heroSrc = settings?.heroImagePath ? getImageUrl(settings.heroImagePath) : heroFallback;
  const profileSrc = settings?.profileImagePath ? getImageUrl(settings.profileImagePath) : aboutFallback;
  const bio = settings?.bio || t('about.text');
  const overlayClass = OVERLAY_CLASS[settings?.heroOverlayOpacity ?? 'medium'];

  const photographerName = photographer?.name || username;
  const canonicalUrl = `${window.location.origin}/${username}`;

  const showServices = !!(settings?.servicesEnabled && settings.services?.length > 0);
  const showTestimonials = !!(settings?.testimonialsEnabled && settings.testimonials?.length > 0);
  const showPackages = !!(settings?.packagesEnabled && settings.packages?.length > 0);
  const showVideo = !!(settings?.videoSectionEnabled && settings.videoUrl);
  const showInstagramFeed = !!(settings?.instagramFeedEnabled && settings.instagramFeedImages?.length > 0);
  const showCtaBanner = !!(settings?.ctaBannerEnabled && settings.ctaBannerHeading);

  const embedUrl = showVideo ? toEmbedUrl(settings!.videoUrl) : null;

  return (
    <main className='pt-16'>
      <Helmet>
        <title>{photographerName} | Photography</title>
        <meta name='description' content={bio} />
        <meta property='og:title' content={`${photographerName} | Photography`} />
        <meta property='og:description' content={bio} />
        <meta property='og:url' content={canonicalUrl} />
        {settings?.profileImagePath && <meta property='og:image' content={getImageUrl(settings.profileImagePath)} />}
        <link rel='canonical' href={canonicalUrl} />
        <script type='application/ld+json'>
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: photographerName,
            description: bio,
            url: canonicalUrl,
          })}
        </script>
      </Helmet>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className='relative h-[85vh] min-h-[500px] flex items-center justify-center overflow-hidden'>
        <img src={heroSrc} alt='Photography' className='absolute inset-0 w-full h-full object-cover' />
        <div className={`absolute inset-0 ${overlayClass}`} />
        <div className='relative z-10 text-center px-4 sm:px-6 max-w-2xl w-full'>
          <FadeIn>
            <h1 className='text-3xl sm:text-4xl md:text-6xl text-foreground mb-4 leading-tight'>
              {photographer.studioName || photographer.name}
            </h1>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className='text-lg md:text-2xl text-primary mb-8'>
              {settings?.heroSubtitle || t('hero.subtitle')}
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <Link
                to={`/${username}/portfolio`}
                className='inline-block px-8 py-3 rounded-lg bg-primary text-primary-foreground font-sans text-sm font-medium hover:opacity-90 transition-opacity'
              >
                {settings?.heroCtaPrimaryLabel || t('hero.cta.gallery')}
              </Link>
              <Link
                to={`/${username}/contact`}
                className='inline-block px-8 py-3 rounded-lg border border-foreground/30 text-foreground font-sans text-sm font-medium hover:bg-foreground/5 transition-colors'
              >
                {settings?.heroCtaSecondaryLabel || t('hero.cta.book')}
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────────────────── */}
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
                <h2 className='text-3xl md:text-4xl text-foreground mb-6'>
                  {settings?.aboutSectionTitle || t('about.title')}
                </h2>
                <p className='text-muted-foreground leading-relaxed text-base whitespace-pre-line'>{bio}</p>
                {(settings?.phone || settings?.instagramHandle || settings?.facebookUrl || settings?.tiktokUrl) && (
                  <div className='flex items-center gap-1 mt-6'>
                    {settings?.phone && (
                      <a
                        href={`tel:${settings.phone}`}
                        aria-label='Phone'
                        className='p-3 text-primary hover:text-primary/70 transition-colors rounded-md hover:bg-primary/10'
                      >
                        <Phone size={22} />
                      </a>
                    )}
                    {settings?.phone && (
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
                    {settings?.instagramHandle && (
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
                    {settings?.facebookUrl && (
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
                    {settings?.tiktokUrl && (
                      <a
                        href={settings.tiktokUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        aria-label='TikTok'
                        className='p-3 text-primary hover:text-primary/70 transition-colors rounded-md hover:bg-primary/10'
                      >
                        <TikTokIcon />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Services ──────────────────────────────────────────────────────── */}
      {showServices && (
        <section className='section-spacing bg-card'>
          <div className='container-narrow'>
            <FadeIn>
              <h2 className='text-3xl md:text-4xl text-center text-foreground mb-12'>
                {t('services.title')}
              </h2>
            </FadeIn>
            <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {settings!.services.map((service, i) => (
                <FadeIn key={service.id} delay={i * 0.07}>
                  <div className='bg-card border border-beige rounded-xl p-6 flex flex-col gap-4'>
                    <ServiceIcon name={service.icon} />
                    <h3 className='text-lg text-foreground'>{service.title}</h3>
                    <p className='text-muted-foreground text-sm leading-relaxed flex-1'>{service.description}</p>
                    {service.startingPrice && (
                      <span className='inline-block text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1 self-start'>
                        {t('services.starting_from')}{service.startingPrice}
                      </span>
                    )}
                    <Link
                      to={`/${username}/contact`}
                      className='mt-auto text-sm text-primary hover:underline'
                    >
                      {t('services.book_session')} →
                    </Link>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Featured Images ────────────────────────────────────────────────── */}
      {settings?.featuredImages && settings.featuredImages.length > 0 && (
        <section className='section-spacing bg-card'>
          <div className='container-narrow'>
            <FadeIn>
              <h2 className='text-3xl md:text-4xl text-center text-foreground mb-12'>{t('showcase.title')}</h2>
            </FadeIn>
            <div className='columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3'>
              {settings.featuredImages.map((img: any, i: number) => (
                <FadeIn key={img._id} delay={i * 0.04}>
                  <div className='break-inside-avoid rounded-xl overflow-hidden'>
                    <img
                      src={getImageUrl(img.thumbnailPath || img.path)}
                      alt={img.originalName || `${photographerName} photography showcase`}
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

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      {showTestimonials && (
        <section className='section-spacing bg-card'>
          <div className='container-narrow'>
            <FadeIn>
              <h2 className='text-3xl md:text-4xl text-center text-foreground mb-12'>
                {t('testimonials.title')}
              </h2>
            </FadeIn>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {settings!.testimonials.map((testimonial, i) => (
                <FadeIn key={testimonial.id} delay={i * 0.1}>
                  <div className='bg-background border border-beige rounded-xl p-6 flex flex-col gap-4'>
                    <span className='text-5xl leading-none text-primary font-serif select-none' aria-hidden='true'>&ldquo;</span>
                    <p className='text-foreground leading-relaxed text-sm flex-1'>{testimonial.text}</p>
                    {testimonial.rating != null && <StarRating rating={testimonial.rating} />}
                    <div>
                      <p className='text-sm font-medium text-foreground'>{testimonial.clientName}</p>
                      {testimonial.sessionType && (
                        <p className='text-xs text-muted-foreground mt-0.5'>{testimonial.sessionType}</p>
                      )}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      {showCtaBanner && (
        <FadeIn>
          <section
            className='relative section-spacing bg-cover bg-center overflow-hidden'
            style={{ backgroundImage: `url(${heroSrc})` }}
          >
            <div className='absolute inset-0 bg-background/60' />
            <div className='relative z-10 container-narrow text-center'>
              <h2 className='text-3xl md:text-5xl text-foreground mb-4'>
                {settings!.ctaBannerHeading}
              </h2>
              {settings!.ctaBannerSubtext && (
                <p className='text-muted-foreground text-lg mb-8 max-w-xl mx-auto'>
                  {settings!.ctaBannerSubtext}
                </p>
              )}
              <Link
                to={`/${username}/contact`}
                className='inline-block px-8 py-3 rounded-lg bg-primary text-primary-foreground font-sans text-sm font-medium hover:opacity-90 transition-opacity'
              >
                {settings!.ctaBannerButtonLabel || t('hero.cta.book')}
              </Link>
            </div>
          </section>
        </FadeIn>
      )}

      {/* ── Packages / Pricing ────────────────────────────────────────────── */}
      {showPackages && (
        <section className='section-spacing'>
          <div className='container-narrow'>
            <FadeIn>
              <h2 className='text-3xl md:text-4xl text-center text-foreground mb-12'>
                {t('packages.title')}
              </h2>
            </FadeIn>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {settings!.packages.map((pkg, i) => (
                <FadeIn key={pkg.id} delay={i * 0.08}>
                  <div
                    className={`bg-card border rounded-xl p-8 flex flex-col relative ${
                      pkg.isHighlighted ? 'border-primary ring-2 ring-primary' : 'border-beige'
                    }`}
                  >
                    {pkg.isHighlighted && (
                      <span className='absolute -top-3 start-1/2 -translate-x-1/2 text-xs font-medium bg-primary text-primary-foreground rounded-full px-3 py-1 whitespace-nowrap'>
                        {t('packages.popular')}
                      </span>
                    )}
                    <h3 className='text-xl text-foreground mb-2'>{pkg.name}</h3>
                    <p className='text-3xl text-primary font-bold mb-6'>{pkg.price}</p>
                    {pkg.inclusions.length > 0 && (
                      <ul className='flex-1 space-y-2 mb-6'>
                        {pkg.inclusions.map((item, idx) => (
                          <li key={idx} className='flex items-start gap-2 text-sm text-muted-foreground'>
                            <span className='text-primary mt-0.5' aria-hidden='true'>✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      to={`/${username}/contact`}
                      className='mt-auto inline-block text-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-sans text-sm font-medium hover:opacity-90 transition-opacity'
                    >
                      {pkg.ctaLabel || t('packages.book_now')}
                    </Link>
                  </div>
                </FadeIn>
              ))}
            </div>
            {settings!.packagesDisclaimer && (
              <FadeIn delay={0.2}>
                <p className='text-center text-xs text-muted-foreground mt-8'>{settings!.packagesDisclaimer}</p>
              </FadeIn>
            )}
          </div>
        </section>
      )}

      {/* ── Blog Preview ──────────────────────────────────────────────────── */}
      {latestPosts && latestPosts.length > 0 && (
        <section className='section-spacing'>
          <div className='container-narrow'>
            <FadeIn>
              <div className='flex items-end justify-between mb-10'>
                <h2 className='text-3xl md:text-4xl text-foreground'>{t('blog.preview.title')}</h2>
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
                          src={getImageUrl(post.featuredImagePath)}
                          alt={post.title}
                          className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-105'
                          loading='lazy'
                        />
                      </div>
                    ) : (
                      <div className='aspect-[4/3] rounded-xl mb-4 bg-secondary' />
                    )}
                    {post.category && (
                      <span className='text-xs text-primary uppercase tracking-wider'>{post.category}</span>
                    )}
                    <h3 className='text-lg text-foreground mt-1 group-hover:text-primary transition-colors'>
                      {post.title}
                    </h3>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Video Reel ────────────────────────────────────────────────────── */}
      {showVideo && embedUrl && (
        <section className='section-spacing bg-card'>
          <div className='container-narrow'>
            {(settings!.videoSectionHeading || settings!.videoSectionSubheading) && (
              <FadeIn>
                <div className='text-center mb-10'>
                  {settings!.videoSectionHeading ? (
                    <h2 className='text-3xl md:text-4xl text-foreground mb-3'>
                      {settings!.videoSectionHeading}
                    </h2>
                  ) : (
                    <h2 className='text-3xl md:text-4xl text-foreground mb-3'>{t('video.title')}</h2>
                  )}
                  {settings!.videoSectionSubheading && (
                    <p className='text-muted-foreground text-lg'>{settings!.videoSectionSubheading}</p>
                  )}
                </div>
              </FadeIn>
            )}
            {!settings!.videoSectionHeading && !settings!.videoSectionSubheading && (
              <FadeIn>
                <h2 className='text-3xl md:text-4xl text-center text-foreground mb-10'>{t('video.title')}</h2>
              </FadeIn>
            )}
            <FadeIn delay={0.1}>
              <div className='relative aspect-video rounded-xl overflow-hidden bg-black'>
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
                  <button
                    onClick={() => setVideoActive(true)}
                    className='absolute inset-0 w-full h-full flex items-center justify-center bg-foreground/10 hover:bg-foreground/20 transition-colors group'
                    aria-label='Play video'
                    type='button'
                  >
                    <span className='w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform'>
                      <Play size={28} className='text-primary-foreground ms-1' fill='currentColor' />
                    </span>
                  </button>
                )}
              </div>
            </FadeIn>
          </div>
        </section>
      )}

      {/* Instagram Feed Strip */}
      {showInstagramFeed && (
        <section className='section-spacing bg-card'>
          <div className='container-narrow'>
            <FadeIn>
              <h2 className='text-3xl md:text-4xl text-center text-foreground mb-10'>{t('instagram.feed.title')}</h2>
            </FadeIn>
            <div className='grid grid-cols-3 gap-2 sm:gap-3'>
              {settings!.instagramFeedImages.map((path, i) => (
                <FadeIn key={path} delay={i * 0.05}>
                  <a
                    href={settings?.instagramHandle ? `https://instagram.com/${settings.instagramHandle.replace('@', '')}` : undefined}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='block aspect-square rounded-xl overflow-hidden bg-secondary'
                  >
                    <img
                      src={getImageUrl(path)}
                      alt={`${photographerName} Instagram`}
                      className='w-full h-full object-cover hover:scale-105 transition-transform duration-300'
                      loading='lazy'
                    />
                  </a>
                </FadeIn>
              ))}
            </div>
            {settings?.instagramHandle && (
              <FadeIn delay={0.3}>
                <div className='text-center mt-8'>
                  <a
                    href={`https://instagram.com/${settings.instagramHandle.replace('@', '')}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-foreground/30 text-foreground text-sm font-medium hover:bg-foreground/5 transition-colors'
                  >
                    {t('instagram.feed.follow')}
                  </a>
                </div>
              </FadeIn>
            )}
          </div>
        </section>
      )}
    </main>
  );
};
