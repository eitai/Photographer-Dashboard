import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePhotographer } from './PhotographerLayout';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import api, { getImageUrl } from '@/lib/api';
import heroFallback from '@/assets/hero-family.jpg';
import aboutFallback from '@/assets/about-koral.jpg';
import {
  Phone,
  Camera,
  Heart,
  Users,
  Star,
  Baby,
  Diamond,
  Building2,
  Mountain,
  Play,
  ChevronLeft,
  ChevronRight,
  Clock,
  Award,
  Smile,
  Aperture,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion, useInView } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const homeContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email').max(255),
  phone: z.string().max(20).optional(),
  session_type: z.string().min(1, 'Please select a session type'),
  message: z.string().max(1000).optional(),
});

type HomeContactFormValues = z.infer<typeof homeContactSchema>;

// ── Social icons ─────────────────────────────────────────────────────────────

const InstagramIcon = () => (
  <svg viewBox='0 0 24 24' width='22' height='22' fill='currentColor'>
    <path d='M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox='0 0 24 24' width='22' height='22' fill='currentColor'>
    <path d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox='0 0 24 24' width='22' height='22' fill='currentColor'>
    <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox='0 0 24 24' width='22' height='22' fill='currentColor'>
    <path d='M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.73a4.85 4.85 0 01-1-.04z' />
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
  aperture: Aperture,
  clock: Clock,
  smile: Smile,
  award: Award,
};

const ServiceIcon = ({ name }: { name: string }) => {
  const Icon = ICON_MAP[name] || Camera;
  return <Icon size={28} className='text-black' />;
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
        <Star key={i} size={14} className='text-black fill-black' />
      ) : (
        <Star key={i} size={14} className='text-black/20' />
      )
    )}
  </div>
);

// ── Animated number counter ──────────────────────────────────────────────────

const AnimatedNumber = ({ target, suffix }: { target: number; suffix: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        start = target;
        clearInterval(timer);
      }
      setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);

  return (
    <span ref={ref} className='text-4xl md:text-5xl font-serif font-bold text-black'>
      {count.toLocaleString()}{suffix}
    </span>
  );
};

// ── Section heading helper ───────────────────────────────────────────────────

const SectionHeading = ({
  title,
  align = 'center',
}: {
  title: string;
  align?: 'center' | 'start';
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
    className={align === 'center' ? 'text-center' : ''}
  >
    <motion.div
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`w-10 h-px bg-black origin-left mb-6 ${align === 'center' ? 'mx-auto' : ''}`}
    />
    <h2 className='text-3xl md:text-4xl font-serif text-black'>{title}</h2>
  </motion.div>
);

// ── Fade-up variant ──────────────────────────────────────────────────────────

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

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

interface StatItem {
  id: string;
  value: number;
  suffix: string;
  label: string;
}

interface PromiseItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface FaqItem {
  id: string;
  q: string;
  a: string;
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
  heroTagline: string;
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
  ctaBannerImagePath: string;
  instagramFeedEnabled: boolean;
  instagramFeedImages: string[];
  contactSectionEnabled: boolean;
  contactSectionHeading: string;
  contactSectionSubheading: string;
  statsEnabled: boolean;
  stats: StatItem[];
  promisesEnabled: boolean;
  promises: PromiseItem[];
  faqEnabled: boolean;
  faqItems: FaqItem[];
  finalCtaHeading: string;
  finalCtaSubtext: string;
  finalCtaButtonLabel: string;
}

const OVERLAY_CLASS: Record<'light' | 'medium' | 'dark', string> = {
  light: 'bg-black/10',
  medium: 'bg-black/30',
  dark: 'bg-black/60',
};

// ── Component ────────────────────────────────────────────────────────────────

export const PhotographerHome = () => {
  const { t, lang } = useI18n();
  const isHe = lang === 'he';
  const { username, photographer } = usePhotographer();
  const [videoActive, setVideoActive] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const { data: settings, isLoading: settingsLoading } = useQuery<PublicSettings>({
    queryKey: ['photographerSettings', username],
    queryFn: () => api.get(`/p/${username}/settings`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: latestPosts } = useQuery<any[]>({
    queryKey: ['photographerBlog', username],
    queryFn: () => api.get(`/p/${username}/blog`).then((r) => r.data.slice(0, 3)),
    staleTime: 5 * 60 * 1000,
  });

  // Don't fall back to the placeholder while settings are still loading — that
  // causes a flash when the real image swaps in. Only use the fallback once we
  // know there is no custom image.
  const heroSrc = settings?.heroImagePath
    ? getImageUrl(settings.heroImagePath)
    : settingsLoading ? null : heroFallback;

  const profileSrc = settings?.profileImagePath ? getImageUrl(settings.profileImagePath) : aboutFallback;

  // Fade the hero image in only after it has finished downloading so there is
  // no jarring swap between a blank background and the image.
  const [heroImgLoaded, setHeroImgLoaded] = useState(false);
  useEffect(() => { setHeroImgLoaded(false); }, [heroSrc]);

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

  const [contactSubmitted, setContactSubmitted] = useState(false);

  const sessionTypes = [
    t('contact.session.family'),
    t('contact.session.maternity'),
    t('contact.session.newborn'),
    t('contact.session.branding'),
    t('contact.session.landscape'),
  ];

  const {
    register: registerContact,
    handleSubmit: handleContactSubmit,
    formState: { errors: contactErrors, isSubmitting: contactSubmitting },
  } = useForm<HomeContactFormValues>({
    resolver: zodResolver(homeContactSchema),
  });

  const onContactSubmit = async (data: HomeContactFormValues) => {
    try {
      await api.post(`/p/${username}/contact`, {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        sessionType: data.session_type,
        message: data.message || null,
      });
      setContactSubmitted(true);
    } catch {
      toast.error(t('contact.error'));
    }
  };

  // ── Stats data ─────────────────────────────────────────────────────────────
  const DEFAULT_STATS: StatItem[] = [
    { id: '1', value: 500, suffix: '+', label: isHe ? 'משפחות מרוצות' : 'Happy Families' },
    { id: '2', value: 10, suffix: '+', label: isHe ? 'שנות ניסיון' : 'Years Experience' },
    { id: '3', value: 1200, suffix: '+', label: isHe ? 'אירועים מצולמים' : 'Events Shot' },
    { id: '4', value: 98, suffix: '%', label: isHe ? 'לקוחות ממליצים' : 'Client Satisfaction' },
  ];
  const activeStats: StatItem[] = (settings?.statsEnabled !== false)
    ? (settings?.stats?.length ? settings.stats : DEFAULT_STATS)
    : [];

  // ── Promises data ──────────────────────────────────────────────────────────
  const DEFAULT_PROMISES: PromiseItem[] = [
    { id: '1', icon: 'aperture', title: isHe ? 'איכות ללא פשרות' : 'Uncompromising Quality', description: isHe ? 'כל תמונה מעובדת בקפידה עם תשומת לב לכל פרט' : 'Every image carefully edited with attention to every detail' },
    { id: '2', icon: 'clock', title: isHe ? 'מסירה מהירה' : 'Fast Delivery', description: isHe ? 'הגלריה שלך מוכנה תוך שבועיים מיום הצילום' : 'Your gallery is ready within two weeks of the shoot' },
    { id: '3', icon: 'smile', title: isHe ? 'חוויה נעימה' : 'Enjoyable Experience', description: isHe ? 'אווירה נינוחה ומחייכת לאורך כל הצילום' : 'A relaxed and joyful atmosphere throughout the shoot' },
    { id: '4', icon: 'award', title: isHe ? 'מקצועיות מוכחת' : 'Proven Expertise', description: isHe ? 'ניסיון של עשר שנים ואלפי לקוחות מרוצים' : 'Ten years of experience and thousands of happy clients' },
  ];
  const activePromises: PromiseItem[] = (settings?.promisesEnabled !== false)
    ? (settings?.promises?.length ? settings.promises : DEFAULT_PROMISES)
    : [];

  // ── FAQ data ───────────────────────────────────────────────────────────────
  const DEFAULT_FAQ: FaqItem[] = isHe
    ? [
        { id: '1', q: 'כמה זמן לוקח לקבל את התמונות?', a: 'הגלריה המלאה מוכנה בדרך כלל תוך שבועיים מיום הצילום. לאירועים גדולים כגון חתונות — עד שלושה שבועות.' },
        { id: '2', q: 'מה כלול בחבילה הבסיסית?', a: 'החבילה הבסיסית כוללת שעת צילום, עיבוד מלא של התמונות, וגלריה דיגיטלית אינטראקטיבית לאחסון ושיתוף.' },
        { id: '3', q: 'האם ניתן לצלם בחוץ?', a: 'כן, אני צולמ/ת בחוץ ובפנים. אני ממליצ/ה על צילומי חוץ בשעת הזהב — שעה לפני השקיעה.' },
        { id: '4', q: 'כיצד ניתן לשמור את התמונות?', a: 'הגלריה הדיגיטלית מאפשרת הורדה של כל התמונות בפורמט מלא ואיכותי ישירות מהדפדפן.' },
        { id: '5', q: 'האם אפשר לבצע הזמנה ברגע האחרון?', a: 'אני נוהג/ת לקבל הזמנות בהתראה קצרה בכפוף לזמינות. מומלץ לתאם מראש, במיוחד בתקופות העמוסות.' },
      ]
    : [
        { id: '1', q: 'How long does it take to receive the photos?', a: 'The full gallery is typically ready within two weeks of the shoot date. For large events like weddings, up to three weeks.' },
        { id: '2', q: 'What is included in the basic package?', a: 'The basic package includes one hour of shooting, full editing of all images, and an interactive digital gallery for storage and sharing.' },
        { id: '3', q: 'Can you shoot outdoors?', a: 'Yes, I shoot both outdoors and indoors. I recommend outdoor sessions during the golden hour — one hour before sunset.' },
        { id: '4', q: 'How do I save my photos?', a: 'The digital gallery allows you to download all images in full quality directly from your browser.' },
        { id: '5', q: 'Can I book at the last minute?', a: 'I do accept last-minute bookings subject to availability. Booking in advance is recommended, especially during busy seasons.' },
      ];
  const activeFaq: FaqItem[] = (settings?.faqEnabled !== false)
    ? (settings?.faqItems?.length ? settings.faqItems : DEFAULT_FAQ)
    : [];

  return (
    <main className='bg-white pt-16'>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>

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

      {/* ── Hero: Video-first split layout ────────────────────────────────── */}
      <section className='min-h-screen bg-white flex items-center px-6 md:px-12 lg:px-20'>
        <div className='max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16'>

          {/* Left: text content */}
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

            {(settings?.phone || settings?.instagramHandle) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className='flex items-center gap-1 mt-10 pt-10 border-t border-black/10'
              >
                {settings?.phone && (
                  <a
                    href={`tel:${settings.phone}`}
                    aria-label='Phone'
                    className='p-3 text-black hover:text-black/60 transition-colors'
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
                    className='p-3 text-black hover:text-black/60 transition-colors'
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
                    className='p-3 text-black hover:text-black/60 transition-colors'
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
                    className='p-3 text-black hover:text-black/60 transition-colors'
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
                    className='p-3 text-black hover:text-black/60 transition-colors'
                  >
                    <TikTokIcon />
                  </a>
                )}
              </motion.div>
            )}
          </div>

          {/* Right: Video player OR hero image */}
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

            {/* Decorative corner lines */}
            <div className='absolute -top-3 -start-3 w-12 h-12 border-t-2 border-s-2 border-black pointer-events-none' />
            <div className='absolute -bottom-3 -end-3 w-12 h-12 border-b-2 border-e-2 border-black pointer-events-none' />
          </motion.div>
        </div>
      </section>

      {/* ── Marquee strip ─────────────────────────────────────────────────── */}
      <div className='overflow-hidden bg-black py-3'>
        <div className='flex whitespace-nowrap animate-marquee'>
          {[...Array(3)].map((_, rep) => (
            <span
              key={rep}
              className='flex items-center gap-8 text-xs font-sans text-white/60 uppercase tracking-widest px-8'
            >
              <span className='text-white'>·</span> צילומי חתונה
              <span className='text-white'>·</span> צילומי משפחה
              <span className='text-white'>·</span> בר מצוות
              <span className='text-white'>·</span> צילומי נוף
              <span className='text-white'>·</span> אירועים
              <span className='text-white'>·</span> צילומי תינוקות
              <span className='text-white'>·</span> Wedding Photography
              <span className='text-white'>·</span> Family Portraits
            </span>
          ))}
        </div>
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
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

      {/* ── Promises ──────────────────────────────────────────────────────── */}
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

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <section className='py-20 px-6 bg-[#F8F8F8]'>
        <div className='max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center'>
          <FadeIn>
            <div className='relative aspect-[3/4] overflow-hidden shadow-2xl'>
              <img src={profileSrc} alt={photographer.name} className='w-full h-full object-cover' />
              <div className='absolute -bottom-4 -end-4 w-24 h-24 border-b-2 border-e-2 border-black' />
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div>
              <SectionHeading title={settings?.aboutSectionTitle || t('about.title')} align='start' />
              <span className='text-6xl font-serif text-black/10 leading-none block mb-2' aria-hidden='true'>&ldquo;</span>
              <p className='text-[#444] leading-relaxed font-sans whitespace-pre-line'>{bio}</p>
              {(settings?.phone || settings?.instagramHandle || settings?.facebookUrl || settings?.tiktokUrl) && (
                <div className='flex items-center gap-1 mt-6'>
                  {settings?.phone && (
                    <a
                      href={`tel:${settings.phone}`}
                      aria-label='Phone'
                      className='p-3 text-black hover:text-black/60 transition-colors'
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
                      className='p-3 text-black hover:text-black/60 transition-colors'
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
                      className='p-3 text-black hover:text-black/60 transition-colors'
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
                      className='p-3 text-black hover:text-black/60 transition-colors'
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
                      className='p-3 text-black hover:text-black/60 transition-colors'
                    >
                      <TikTokIcon />
                    </a>
                  )}
                </div>
              )}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Services ──────────────────────────────────────────────────────── */}
      {showServices && (
        <section className='py-20 px-6 bg-white'>
          <div className='max-w-5xl mx-auto'>
            <SectionHeading title={t('services.title')} />
            <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-14'>
              {settings!.services.map((service, i) => (
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

      {/* ── Featured Images ────────────────────────────────────────────────── */}
      {settings?.featuredImages && settings.featuredImages.length > 0 && (
        <section className='py-20 px-6 bg-[#F8F8F8]'>
          <div className='max-w-5xl mx-auto'>
            <SectionHeading title={t('showcase.title')} />
            <div className='columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3 mt-14'>
              {settings.featuredImages.map((img: any, i: number) => (
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

      {/* ── Testimonials — editorial style ────────────────────────────────── */}
      {showTestimonials && (
        <section className='py-20 px-6 bg-[#F8F8F8]'>
          <div className='max-w-4xl mx-auto'>
            <SectionHeading title={t('testimonials.title')} />

            <div className='mt-16 flex items-start gap-8'>
              {/* Large faded index number */}
              <span className='text-[100px] md:text-[140px] font-light font-serif leading-none text-black/[0.08] select-none shrink-0 hidden md:block'>
                {String(activeTestimonial + 1).padStart(2, '0')}
              </span>

              <div className='flex-1'>
                {/* Quote */}
                <motion.blockquote
                  key={activeTestimonial}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className='text-2xl md:text-3xl font-serif text-black leading-relaxed mb-10'
                >
                  &ldquo;{settings!.testimonials[activeTestimonial].text}&rdquo;
                </motion.blockquote>

                {/* Author */}
                <motion.div
                  key={`author-${activeTestimonial}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className='flex items-center gap-4'
                >
                  <div className='w-10 h-0.5 bg-black' />
                  <div>
                    <p className='font-semibold font-sans text-black'>
                      {settings!.testimonials[activeTestimonial].clientName}
                    </p>
                    {settings!.testimonials[activeTestimonial].sessionType && (
                      <p className='text-sm text-[#666] font-sans'>
                        {settings!.testimonials[activeTestimonial].sessionType}
                      </p>
                    )}
                  </div>
                  {settings!.testimonials[activeTestimonial].rating != null && (
                    <StarRating rating={settings!.testimonials[activeTestimonial].rating!} />
                  )}
                </motion.div>

                {/* Navigation */}
                <div className='flex items-center gap-8 mt-12 pt-8 border-t border-black/10'>
                  <div className='flex gap-4 items-center'>
                    {settings!.testimonials.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveTestimonial(idx)}
                        aria-label={`Testimonial ${idx + 1}`}
                        className={`h-px transition-all duration-300 ${
                          idx === activeTestimonial
                            ? 'w-10 bg-black'
                            : 'w-5 bg-black/20 hover:w-7 hover:bg-black/40'
                        }`}
                      />
                    ))}
                  </div>
                  <span className='text-xs text-[#666] uppercase tracking-wider font-sans'>
                    {String(activeTestimonial + 1).padStart(2, '0')} / {String(settings!.testimonials.length).padStart(2, '0')}
                  </span>
                  <div className='ms-auto flex gap-2'>
                    <button
                      onClick={() => setActiveTestimonial((p) => Math.max(0, p - 1))}
                      disabled={activeTestimonial === 0}
                      aria-label='Previous testimonial'
                      className='p-2 text-black/40 hover:text-black disabled:opacity-20 transition-colors'
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setActiveTestimonial((p) => Math.min(settings!.testimonials.length - 1, p + 1))}
                      disabled={activeTestimonial === settings!.testimonials.length - 1}
                      aria-label='Next testimonial'
                      className='p-2 text-black/40 hover:text-black disabled:opacity-20 transition-colors'
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Pricing / Packages ────────────────────────────────────────────── */}
      {showPackages && (
        <section className='py-20 px-6 bg-white'>
          <div className='max-w-5xl mx-auto'>
            <SectionHeading title={t('packages.title')} />
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 items-center'>
              {settings!.packages.map((pkg, i) => (
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
            {settings!.packagesDisclaimer && (
              <FadeIn delay={0.2}>
                <p className='text-center text-xs text-[#666] mt-8 font-sans'>{settings!.packagesDisclaimer}</p>
              </FadeIn>
            )}
          </div>
        </section>
      )}

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      {activeFaq.length > 0 && (
        <section className='py-20 px-6 bg-[#F8F8F8]'>
          <div className='max-w-3xl mx-auto'>
            <SectionHeading title={isHe ? 'שאלות נפוצות' : 'FAQ'} />
            <Accordion type='single' collapsible className='mt-12 divide-y divide-black/10 border-t border-black/10'>
              {activeFaq.map((item, i) => (
                <AccordionItem key={item.id} value={`faq-${item.id}`} className='border-b-0'>
                  <AccordionTrigger className='text-[#111] font-sans font-medium py-6 text-start hover:no-underline hover:text-black [&>svg]:text-black [&>svg]:shrink-0'>
                    <span className='flex items-center gap-4'>
                      <span className='text-black/25 font-serif text-sm tabular-nums w-6'>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {item.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className='text-[#666] text-base leading-relaxed pb-6 font-sans ps-10'>
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* ── Instagram Feed ────────────────────────────────────────────────── */}
      {showInstagramFeed && (
        <section className='py-20 px-6 bg-white'>
          <div className='max-w-5xl mx-auto'>
            <SectionHeading title={t('instagram.feed.title')} />
            <div className='grid grid-cols-3 gap-2 sm:gap-3 mt-14'>
              {settings!.instagramFeedImages.map((path, i) => (
                <FadeIn key={path} delay={i * 0.05}>
                  <a
                    href={settings?.instagramHandle ? `https://instagram.com/${settings.instagramHandle.replace('@', '')}` : undefined}
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
            {settings?.instagramHandle && (
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

      {/* ── Blog Preview ──────────────────────────────────────────────────── */}
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

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      {showCtaBanner && (
        <FadeIn>
          <section
            className='relative py-20 px-6 bg-cover bg-center overflow-hidden'
            style={settings?.ctaBannerImagePath ? { backgroundImage: `url(${getImageUrl(settings.ctaBannerImagePath)})` } : undefined}
          >
            <div className={`absolute inset-0 ${settings?.ctaBannerImagePath ? 'bg-black/50' : 'bg-black'}`} />
            <div className='relative z-10 max-w-5xl mx-auto text-center'>
              <h2 className='text-3xl md:text-5xl font-serif text-white mb-4'>
                {settings!.ctaBannerHeading}
              </h2>
              {settings!.ctaBannerSubtext && (
                <p className='text-white/70 text-lg mb-8 max-w-xl mx-auto font-sans'>
                  {settings!.ctaBannerSubtext}
                </p>
              )}
              <Link
                to={`/${username}/contact`}
                className={`inline-block px-8 py-3 text-sm font-sans font-medium transition-colors rounded-none ${
                  settings?.ctaBannerImagePath
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {settings!.ctaBannerButtonLabel || t('hero.cta.book')}
              </Link>
            </div>
          </section>
        </FadeIn>
      )}

      {/* ── Final CTA — full black ─────────────────────────────────────────── */}
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
              {settings?.finalCtaHeading || (isHe ? 'מוכנים לצלם?' : 'Ready to Shoot?')}
            </h2>
            <p className='text-white/50 text-lg mb-12 font-sans max-w-md mx-auto'>
              {settings?.finalCtaSubtext || (isHe
                ? 'צרו קשר היום ונתאים יחד את הצילום המושלם עבורכם'
                : 'Contact us and we will plan the perfect shoot together')}
            </p>
            <a
              href='#contact'
              className='inline-block px-12 py-4 bg-white text-black text-sm font-sans font-semibold hover:bg-white/90 transition-colors rounded-none'
            >
              {settings?.finalCtaButtonLabel || (isHe ? 'שלח הודעה' : 'Send a Message')}
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Contact Form ──────────────────────────────────────────────────── */}
      {settings?.contactSectionEnabled !== false && (
        <section id='contact' className='py-20 px-6 bg-white'>
          <div className='max-w-5xl mx-auto grid lg:grid-cols-2 gap-16 items-start'>
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <SectionHeading
                title={settings?.contactSectionHeading || t('contact.title')}
                align='start'
              />
              <p className='text-[#666] mt-4 font-sans'>
                {settings?.contactSectionSubheading || t('contact.subtitle')}
              </p>
            </motion.div>

            {/* Right: form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              {contactSubmitted ? (
                <div className='py-12 text-center'>
                  <span className='text-5xl font-serif text-black block mb-4'>✓</span>
                  <p className='text-xl font-serif text-black'>{t('contact.success')}</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit(onContactSubmit)} className='space-y-8'>
                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.name')}
                    </label>
                    <input
                      type='text'
                      {...registerContact('name')}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors placeholder-black/20'
                    />
                    {contactErrors.name && (
                      <p className='text-xs text-rose-500 mt-1 font-sans'>{contactErrors.name.message}</p>
                    )}
                  </div>

                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.phone')}
                    </label>
                    <input
                      type='tel'
                      {...registerContact('phone')}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors placeholder-black/20'
                    />
                  </div>

                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.email')}
                    </label>
                    <input
                      type='email'
                      {...registerContact('email')}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors placeholder-black/20'
                    />
                    {contactErrors.email && (
                      <p className='text-xs text-rose-500 mt-1 font-sans'>{contactErrors.email.message}</p>
                    )}
                  </div>

                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.session')}
                    </label>
                    <select
                      {...registerContact('session_type')}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors'
                    >
                      <option value=''>—</option>
                      {sessionTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {contactErrors.session_type && (
                      <p className='text-xs text-rose-500 mt-1 font-sans'>{contactErrors.session_type.message}</p>
                    )}
                  </div>

                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.message')}
                    </label>
                    <textarea
                      {...registerContact('message')}
                      rows={4}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors placeholder-black/20 resize-none'
                    />
                  </div>

                  <button
                    type='submit'
                    disabled={contactSubmitting}
                    className='w-full py-4 bg-black text-white text-sm font-sans font-medium hover:bg-black/80 transition-colors disabled:opacity-50'
                  >
                    {contactSubmitting ? t('contact.submitting') : t('contact.send')}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </section>
      )}
    </main>
  );
};
