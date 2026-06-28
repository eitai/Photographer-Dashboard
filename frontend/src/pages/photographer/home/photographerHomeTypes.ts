export interface ServiceItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  startingPrice: string | null;
  sessionTypeValue: string | null;
}

export interface TestimonialItem {
  id: string;
  text: string;
  clientName: string;
  sessionType: string | null;
  rating: number | null;
}

export interface PackageItem {
  id: string;
  name: string;
  price: string;
  inclusions: string[];
  isHighlighted: boolean;
  ctaLabel: string | null;
}

export interface StatItem {
  id: string;
  value: number;
  suffix: string;
  label: string;
}

export interface PromiseItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface FeaturedImage {
  _id: string;
  path: string;
  thumbnailPath?: string;
  originalName?: string;
}

export interface PublicSettings {
  featuredImages: FeaturedImage[];
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

export const OVERLAY_CLASS: Record<'light' | 'medium' | 'dark', string> = {
  light: 'bg-black/10',
  medium: 'bg-black/30',
  dark: 'bg-black/60',
};

export const DEFAULT_STATS = (isHe: boolean): StatItem[] => [
  { id: '1', value: 500, suffix: '+', label: isHe ? 'משפחות מרוצות' : 'Happy Families' },
  { id: '2', value: 10, suffix: '+', label: isHe ? 'שנות ניסיון' : 'Years Experience' },
  { id: '3', value: 1200, suffix: '+', label: isHe ? 'אירועים מצולמים' : 'Events Shot' },
  { id: '4', value: 98, suffix: '%', label: isHe ? 'לקוחות ממליצים' : 'Client Satisfaction' },
];

export const DEFAULT_PROMISES = (isHe: boolean): PromiseItem[] => [
  { id: '1', icon: 'aperture', title: isHe ? 'איכות ללא פשרות' : 'Uncompromising Quality', description: isHe ? 'כל תמונה מעובדת בקפידה עם תשומת לב לכל פרט' : 'Every image carefully edited with attention to every detail' },
  { id: '2', icon: 'clock', title: isHe ? 'מסירה מהירה' : 'Fast Delivery', description: isHe ? 'הגלריה שלך מוכנה תוך שבועיים מיום הצילום' : 'Your gallery is ready within two weeks of the shoot' },
  { id: '3', icon: 'smile', title: isHe ? 'חוויה נעימה' : 'Enjoyable Experience', description: isHe ? 'אווירה נינוחה ומחייכת לאורך כל הצילום' : 'A relaxed and joyful atmosphere throughout the shoot' },
  { id: '4', icon: 'award', title: isHe ? 'מקצועיות מוכחת' : 'Proven Expertise', description: isHe ? 'ניסיון של עשר שנים ואלפי לקוחות מרוצים' : 'Ten years of experience and thousands of happy clients' },
];

export const DEFAULT_FAQ = (isHe: boolean): FaqItem[] =>
  isHe
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

export function toEmbedUrl(url: string): string | null {
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
