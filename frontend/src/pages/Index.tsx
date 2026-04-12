import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useInView,
} from 'framer-motion';
import { useI18n } from '../lib/i18n';

// ---------------------------------------------------------------------------
// Mouse-tracking 3D tilt card
// ---------------------------------------------------------------------------
function TiltCard({
  children,
  className = '',
  intensity = 12,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-intensity, intensity]);
  const springX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current!.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <div
      ref={ref}
      style={{ perspective: 800 }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      className={className}
    >
      <motion.div style={{ rotateX: springX, rotateY: springY, transformStyle: 'preserve-3d' }}>
        {children}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating orb
// ---------------------------------------------------------------------------
function Orb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{ y: [0, -24, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 7 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

// ---------------------------------------------------------------------------
// Scroll-reveal (in-view) wrapper
// ---------------------------------------------------------------------------
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 40, rotateX: 12 }}
      animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ transformPerspective: 800 }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// useScrollParallax — reusable scroll-driven transform hook
// ---------------------------------------------------------------------------
function useScrollParallax(
  ref: React.RefObject<HTMLElement>,
  inputRange: [number, number],
  outputRange: [number | string, number | string],
) {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  return useTransform(scrollYProgress, inputRange, outputRange);
}

// ---------------------------------------------------------------------------
// Static data (non-translatable parts)
// ---------------------------------------------------------------------------
const PHOTO_GRADIENTS = [
  'bg-gradient-to-br from-[#e8ddd0] to-[#d4c5b2]',
  'bg-gradient-to-br from-[#d0dae8] to-[#b2c1d4]',
  'bg-gradient-to-br from-[#dde8d0] to-[#c5d4b2]',
  'bg-gradient-to-br from-[#e8d0d8] to-[#d4b2bf]',
  'bg-gradient-to-br from-[#d8d0e8] to-[#bfb2d4]',
  'bg-gradient-to-br from-[#e8e0d0] to-[#d4ccb2]',
  'bg-gradient-to-br from-[#d0e4e8] to-[#b2cfd4]',
  'bg-gradient-to-br from-[#e2d0e8] to-[#ccb2d4]',
];
const SELECTED_ITEMS = new Set([1, 3, 6, 8]);

const STAT_KEYS = [
  { value: '2,400+', labelKey: 'landing.stats.galleries' },
  { value: '98%',    labelKey: 'landing.stats.satisfaction' },
  { value: '4.9★',  labelKey: 'landing.stats.rating' },
];

const TAG_KEYS = [
  'landing.tags.wedding', 'landing.tags.portrait', 'landing.tags.family',
  'landing.tags.newborn', 'landing.tags.events',   'landing.tags.commercial',
  'landing.tags.boudoir', 'landing.tags.maternity', 'landing.tags.realestate',
  'landing.tags.fashion', 'landing.tags.editorial', 'landing.tags.brand',
];
// doubled for seamless marquee loop
const MARQUEE_TAG_KEYS = [...TAG_KEYS, ...TAG_KEYS];

const FEATURE_KEYS = [
  { icon: '📁', titleKey: 'landing.feature.upload.title',    descKey: 'landing.feature.upload.desc' },
  { icon: '🔔', titleKey: 'landing.feature.alerts.title',    descKey: 'landing.feature.alerts.desc' },
  { icon: '📋', titleKey: 'landing.feature.pipeline.title',  descKey: 'landing.feature.pipeline.desc' },
  { icon: '🛍️', titleKey: 'landing.feature.store.title',     descKey: 'landing.feature.store.desc' },
  { icon: '🎨', titleKey: 'landing.feature.themes.title',    descKey: 'landing.feature.themes.desc' },
  { icon: '🌐', titleKey: 'landing.feature.bilingual.title', descKey: 'landing.feature.bilingual.desc' },
];

const STEP_KEYS = [
  { n: '01', titleKey: 'landing.step.1.title', descKey: 'landing.step.1.desc' },
  { n: '02', titleKey: 'landing.step.2.title', descKey: 'landing.step.2.desc' },
  { n: '03', titleKey: 'landing.step.3.title', descKey: 'landing.step.3.desc' },
  { n: '04', titleKey: 'landing.step.4.title', descKey: 'landing.step.4.desc' },
];

const NOTIFICATION_KEYS = [
  { dot: 'bg-green-400',  titleKey: 'landing.notif.1.title', subKey: 'landing.notif.1.sub' },
  { dot: 'bg-blue-400',   titleKey: 'landing.notif.2.title', subKey: 'landing.notif.2.sub' },
  { dot: 'bg-orange-400', titleKey: 'landing.notif.3.title', subKey: 'landing.notif.3.sub' },
  { dot: 'bg-purple-400', titleKey: 'landing.notif.4.title', subKey: 'landing.notif.4.sub' },
];

const THEMES = [
  { nameKey: 'Luxury',   color: '#1a1410', accent: '#c9a96e' },
  { nameKey: 'Soft',     color: '#FAF8F4', accent: '#E7B8B5' },
  { nameKey: 'Midnight', color: '#0d1117', accent: '#6eb5ff' },
];

const TESTIMONIAL_KEYS = [
  { quoteKey: 'landing.testimonial.1.quote', nameKey: 'landing.testimonial.1.name', roleKey: 'landing.testimonial.1.role', grad: 'from-[#E7B8B5] to-[#d4a0a0]' },
  { quoteKey: 'landing.testimonial.2.quote', nameKey: 'landing.testimonial.2.name', roleKey: 'landing.testimonial.2.role', grad: 'from-[#a0b4e8] to-[#8090c8]' },
  { quoteKey: 'landing.testimonial.3.quote', nameKey: 'landing.testimonial.3.name', roleKey: 'landing.testimonial.3.role', grad: 'from-[#a8c59a] to-[#88a87a]' },
];

const PRODUCT_KEYS = [
  { labelKey: 'landing.products.albums', price: 'From ₪180', grad: 'from-[#e8ddd0] to-[#c5b49a]', z: 28 },
  { labelKey: 'landing.products.prints', price: 'From ₪35',  grad: 'from-[#d0dae8] to-[#9aaec5]', z: 4  },
  { labelKey: 'landing.products.canvas', price: 'From ₪450', grad: 'from-[#dde8d0] to-[#a8c59a]', z: 28 },
];

const NAV_LINK_KEYS = [
  { labelKey: 'landing.nav.features',     href: '#features' },
  { labelKey: 'landing.nav.how_it_works', href: '#workflow' },
  { labelKey: 'landing.nav.galleries',    href: '#galleries' },
  { labelKey: 'landing.nav.products',     href: '#products' },
];

const gradientText = {
  background: 'linear-gradient(135deg, #E7B8B5 0%, #d4a0a0 40%, #c8b8e8 100%)',
  WebkitBackgroundClip: 'text' as const,
  WebkitTextFillColor: 'transparent' as const,
  backgroundClip: 'text' as const,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export const Index = () => {
  const { t, lang, toggleLang } = useI18n();
  const [themeHovered, setThemeHovered] = useState(false);

  // Hero scroll parallax
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });

  const mockupRotateX = useTransform(heroScroll, [0, 0.6], [14, -4]);
  const mockupY       = useTransform(heroScroll, [0, 1], [0, 120]);
  const mockupScale   = useTransform(heroScroll, [0, 0.5], [1, 0.88]);
  const orbY1         = useTransform(heroScroll, [0, 1], [0, -80]);
  const orbY2         = useTransform(heroScroll, [0, 1], [0, -140]);
  const textY         = useTransform(heroScroll, [0, 0.5], [0, -60]);
  const textOpacity   = useTransform(heroScroll, [0, 0.35], [1, 0]);

  const springRotateX = useSpring(mockupRotateX, { stiffness: 80, damping: 18 });
  const springScale   = useSpring(mockupScale,   { stiffness: 80, damping: 18 });

  // Phone mockup scroll rotation
  const phoneRef    = useRef<HTMLDivElement>(null);
  const phoneRotateY = useScrollParallax(phoneRef as React.RefObject<HTMLElement>, [0, 1], [-8, 8]);
  const phoneRotateX = useScrollParallax(phoneRef as React.RefObject<HTMLElement>, [0, 1], [4, -4]);

  // Global scroll progress bar
  const { scrollYProgress } = useScroll();
  const progressScaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <div className='min-h-screen bg-white font-sans text-[#1a1a1a] antialiased overflow-x-hidden'>

      {/* Progress bar */}
      <motion.div
        className='fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#E7B8B5] via-[#d4a0a0] to-[#E7B8B5] z-[60] origin-left'
        style={{ scaleX: progressScaleX }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* NAV                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <motion.header
        className='fixed inset-x-0 top-[2px] z-50'
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className='mx-4 mt-3 rounded-2xl bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.4)]'>
          <div className='max-w-6xl mx-auto px-6 h-14 flex items-center justify-between'>
            <Link to='/' className='text-white text-lg tracking-tight font-medium'>
              Koral Light Studio
            </Link>
            <nav className='hidden md:flex items-center gap-8'>
              {NAV_LINK_KEYS.map((l) => (
                <a key={l.labelKey} href={l.href} className='text-sm text-white/60 hover:text-white transition-colors'>
                  {t(l.labelKey)}
                </a>
              ))}
            </nav>
            <div className='flex items-center gap-4'>
              <button
                onClick={toggleLang}
                className='text-xs text-white/50 hover:text-white/80 transition-colors border border-white/15 rounded-full px-2.5 py-1'
              >
                {lang === 'he' ? 'EN' : 'עב'}
              </button>
              <Link to='/admin' className='text-sm text-white/60 hover:text-white transition-colors hidden sm:block'>
                {t('landing.nav.login')}
              </Link>
              <Link
                to='/admin'
                className='hidden sm:inline-flex items-center px-4 py-2 rounded-xl bg-white text-[#0a0a0a] text-sm font-medium hover:bg-white/90 transition-colors'
              >
                {t('landing.nav.get_started')}
              </Link>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ------------------------------------------------------------------ */}
      {/* HERO — dark, 3D scroll-driven                                        */}
      {/* ------------------------------------------------------------------ */}
      <section
        ref={heroRef}
        className='relative min-h-[110vh] flex flex-col items-center justify-center bg-[#080808] overflow-hidden px-6 pt-28 pb-32'
      >
        {/* Ambient orbs */}
        <motion.div style={{ y: orbY1 }} className='absolute inset-0 pointer-events-none'>
          <Orb className='w-[600px] h-[600px] bg-[#E7B8B5]/20 top-[-10%] left-[-10%]' delay={0} />
          <Orb className='w-[500px] h-[500px] bg-[#a0b4e8]/15 bottom-[-5%] right-[-5%]' delay={2} />
        </motion.div>
        <motion.div style={{ y: orbY2 }} className='absolute inset-0 pointer-events-none'>
          <Orb className='w-[300px] h-[300px] bg-[#d4b2d8]/20 top-[30%] right-[15%]' delay={1} />
        </motion.div>

        {/* Grid overlay */}
        <div
          className='absolute inset-0 pointer-events-none opacity-[0.04]'
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Hero text */}
        <motion.div
          style={{ y: textY, opacity: textOpacity }}
          className='relative z-10 text-center max-w-4xl mx-auto mb-16'
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/15 text-xs text-white/60 mb-8'
          >
            <span className='w-2 h-2 rounded-full bg-green-400 inline-block' />
            {t('landing.hero.badge')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className='text-5xl md:text-7xl font-light text-white leading-[1.05] mb-6 tracking-tight'
          >
            {t('landing.hero.h1_line1')}
            <br />
            {t('landing.hero.h1_mid')}{' '}
            <em className='font-light not-italic' style={gradientText}>
              {t('landing.hero.h1_accent')}
            </em>{' '}
            {t('landing.hero.h1_post')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className='text-lg md:text-xl text-white/50 font-light leading-relaxed mb-10 max-w-2xl mx-auto'
          >
            {t('landing.hero.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className='flex flex-col sm:flex-row gap-3 justify-center'
          >
            <Link
              to='/admin'
              className='inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-white text-[#0a0a0a] text-sm font-medium hover:bg-white/90 transition-colors'
            >
              {t('landing.hero.cta_trial')}
            </Link>
            <a
              href='#workflow'
              className='inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/20 text-white/80 text-sm font-medium hover:bg-white/5 transition-colors'
            >
              {t('landing.hero.cta_how')}
            </a>
          </motion.div>
        </motion.div>

        {/* 3D Browser mockup */}
        <div className='relative z-10 w-full max-w-4xl mx-auto' style={{ perspective: 1400 }}>
          <motion.div
            style={{ rotateX: springRotateX, y: mockupY, scale: springScale, transformStyle: 'preserve-3d' }}
            initial={{ opacity: 0, y: 60, rotateX: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className='rounded-2xl overflow-hidden border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)]'
          >
            {/* Chrome bar */}
            <div className='bg-[#1a1a1a] border-b border-white/8 px-4 py-3 flex items-center gap-3'>
              <div className='flex gap-1.5'>
                <span className='w-3 h-3 rounded-full bg-[#ff5f57]' />
                <span className='w-3 h-3 rounded-full bg-[#febc2e]' />
                <span className='w-3 h-3 rounded-full bg-[#28c840]' />
              </div>
              <div className='flex-1 bg-[#0a0a0a] rounded-md px-3 py-1 text-xs text-white/30 border border-white/8 max-w-sm mx-auto text-center'>
                koralstudio.app/gallery/sarah-david-wedding
              </div>
            </div>

            {/* App body */}
            <div className='flex bg-[#111111]'>
              {/* Sidebar */}
              <aside className='hidden sm:flex flex-col w-52 shrink-0 border-r border-white/8 p-4 bg-[#0e0e0e]'>
                <p className='text-sm text-white/90 mb-1 font-medium'>{t('landing.mockup.client')}</p>
                <p className='text-[11px] text-white/30 mb-4'>{t('landing.mockup.session')}</p>
                <div className='space-y-2.5'>
                  {[
                    { labelKey: 'landing.mockup.total',    value: '248' },
                    { labelKey: 'landing.mockup.selected', value: '23' },
                    { labelKey: 'landing.mockup.status',   value: t('landing.mockup.in_editing') },
                  ].map((stat) => (
                    <div key={stat.labelKey} className='flex justify-between text-[11px]'>
                      <span className='text-white/35'>{t(stat.labelKey)}</span>
                      <span className='font-medium text-white/80'>{stat.value}</span>
                    </div>
                  ))}
                </div>
                <div className='mt-6 rounded-lg bg-[#E7B8B5]/15 border border-[#E7B8B5]/20 p-3'>
                  <p className='text-[10px] text-[#E7B8B5] font-medium'>{t('landing.mockup.progress_label')}</p>
                  <div className='mt-2 h-1.5 rounded-full bg-white/10'>
                    <div className='h-full w-[68%] rounded-full bg-[#E7B8B5]' />
                  </div>
                  <p className='text-[10px] text-white/30 mt-1'>{t('landing.mockup.progress_count')}</p>
                </div>
              </aside>

              {/* Photo grid */}
              <div className='flex-1 p-4'>
                <div className='grid grid-cols-4 gap-2'>
                  {PHOTO_GRADIENTS.map((grad, i) => {
                    const num = i + 1;
                    const isSelected = SELECTED_ITEMS.has(num);
                    return (
                      <div
                        key={num}
                        className={`relative aspect-square rounded-lg ${grad} ${isSelected ? 'ring-2 ring-[#E7B8B5]' : 'opacity-60'}`}
                      >
                        {isSelected && (
                          <div className='absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#E7B8B5] flex items-center justify-center'>
                            <svg className='w-3 h-3 text-white' fill='none' stroke='currentColor' strokeWidth='2.5' viewBox='0 0 24 24'>
                              <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Reflection */}
          <div
            className='absolute inset-x-8 -bottom-8 h-20 rounded-b-2xl opacity-30 blur-2xl pointer-events-none'
            style={{ background: 'linear-gradient(180deg, rgba(231,184,181,0.4) 0%, transparent 100%)' }}
          />
        </div>
      </section>

      {/* Transition band */}
      <div className='bg-gradient-to-b from-[#080808] to-white h-24' />

      {/* ------------------------------------------------------------------ */}
      {/* SOCIAL PROOF BAR                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-10 border-y border-[#f0eeeb] bg-[#fafaf9] overflow-hidden'>
        <div className='max-w-6xl mx-auto px-6'>
          <div className='flex flex-col sm:flex-row items-center justify-center gap-10 mb-8'>
            {STAT_KEYS.map((s, i) => (
              <Reveal key={s.labelKey} delay={i * 0.1} className='text-center'>
                <p className='text-2xl font-semibold text-[#1a1a1a]' style={gradientText}>
                  {s.value}
                </p>
                <p className='text-xs text-[#999999] mt-0.5'>{t(s.labelKey)}</p>
              </Reveal>
            ))}
          </div>

          {/* Marquee */}
          <div className='relative overflow-hidden'>
            <div className='absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#fafaf9] to-transparent z-10 pointer-events-none' />
            <div className='absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#fafaf9] to-transparent z-10 pointer-events-none' />
            <motion.div
              className='flex gap-8 whitespace-nowrap'
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            >
              {MARQUEE_TAG_KEYS.map((key, i) => (
                <span
                  key={i}
                  className='text-sm font-medium text-[#6b6b6b] px-4 py-1.5 rounded-full border border-[#e8e6e3] bg-white inline-block'
                >
                  {t(key)}
                </span>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FEATURES — deep 3D tilt cards                                        */}
      {/* ------------------------------------------------------------------ */}
      <section id='features' className='py-28 px-6 bg-white'>
        <div className='max-w-6xl mx-auto'>
          <Reveal className='text-center mb-16'>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>{t('landing.features.label')}</span>
            <h2 className='text-3xl md:text-4xl text-[#1a1a1a] mt-3 leading-snug font-light'>
              {t('landing.features.heading_pre')}{' '}
              <em className='italic'>{t('landing.features.heading_accent')}</em>{' '}
              {t('landing.features.heading_post')}
            </h2>
          </Reveal>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
            {FEATURE_KEYS.map((f, i) => (
              <Reveal key={f.titleKey} delay={i * 0.08}>
                <TiltCard className='h-full' intensity={8}>
                  <div
                    className='p-6 rounded-2xl border border-[#e8e6e3] hover:border-[#E7B8B5]/60 transition-all duration-300 h-full'
                    style={{
                      background: 'linear-gradient(145deg, #fff 0%, #fdf8f7 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 20px 60px rgba(0,0,0,0.06)',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    <div
                      className='w-11 h-11 rounded-xl mb-5 flex items-center justify-center text-xl'
                      style={{
                        background: 'linear-gradient(135deg, #fdf4f3 0%, #f8ece9 100%)',
                        border: '1px solid #f0dbd9',
                        transform: 'translateZ(28px)',
                        boxShadow: '0 8px 24px rgba(231,184,181,0.2)',
                      }}
                    >
                      {f.icon}
                    </div>
                    <h3 className='font-semibold text-[#1a1a1a] mb-2' style={{ transform: 'translateZ(16px)' }}>
                      {t(f.titleKey)}
                    </h3>
                    <p className='text-sm text-[#6b6b6b] leading-relaxed' style={{ transform: 'translateZ(8px)' }}>
                      {t(f.descKey)}
                    </p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* WORKFLOW — lens-ring steps                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id='workflow' className='py-28 px-6 bg-[#fafaf9] relative overflow-hidden'>
        <div
          className='absolute inset-0 opacity-[0.025] pointer-events-none'
          style={{
            backgroundImage: 'linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className='max-w-6xl mx-auto relative'>
          <Reveal className='text-center mb-20'>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>{t('landing.workflow.label')}</span>
            <h2 className='text-3xl md:text-4xl text-[#1a1a1a] mt-3 leading-snug font-light'>
              {t('landing.workflow.heading_l1')}
              <br />
              {t('landing.workflow.heading_in')}{' '}
              <em className='italic'>{t('landing.workflow.heading_num')}</em>{' '}
              {t('landing.workflow.heading_end')}
            </h2>
          </Reveal>

          <div className='relative'>
            {/* Connector line — lg only */}
            <div
              className='hidden lg:block absolute top-[44px] left-[12.5%] right-[12.5%] h-px pointer-events-none'
              style={{ background: 'linear-gradient(90deg, transparent 0%, #E7B8B5 20%, #E7B8B5 80%, transparent 100%)' }}
            />

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10'>
              {STEP_KEYS.map((step, i) => (
                <Reveal key={step.n} delay={i * 0.12}>
                  <TiltCard intensity={6}>
                    <div className='flex flex-col items-center text-center' style={{ transformStyle: 'preserve-3d' }}>
                      {/* Lens-ring circle */}
                      <div className='relative w-[88px] h-[88px] flex items-center justify-center mb-6 shrink-0' style={{ transform: 'translateZ(24px)' }}>
                        <div
                          className='absolute inset-0 rounded-full'
                          style={{
                            background: `conic-gradient(#E7B8B5 0deg, #d4a0a0 ${(i + 1) * 90}deg, transparent ${(i + 1) * 90}deg, transparent 360deg)`,
                            padding: '3px',
                          }}
                        >
                          <div className='w-full h-full rounded-full bg-[#fafaf9]' />
                        </div>
                        <div
                          className='absolute inset-[5px] rounded-full border border-[#e8e6e3]'
                          style={{ background: 'linear-gradient(145deg, #fff 0%, #f5f0ef 100%)' }}
                        />
                        <span className='relative z-10 text-lg font-bold text-[#1a1a1a] tracking-tight'>
                          {step.n}
                        </span>
                      </div>
                      <h3 className='font-semibold text-[#1a1a1a] mb-2 text-lg' style={{ transform: 'translateZ(14px)' }}>
                        {t(step.titleKey)}
                      </h3>
                      <p className='text-sm text-[#6b6b6b] leading-relaxed' style={{ transform: 'translateZ(8px)' }}>
                        {t(step.descKey)}
                      </p>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SPLIT — Real-time Tracking                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id='galleries' className='py-28 px-6 bg-white'>
        <div className='max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center'>
          <Reveal>
            <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-[10px] font-semibold text-green-600 uppercase tracking-widest mb-4'>
              <span className='w-1.5 h-1.5 rounded-full bg-green-500 inline-block' />
              {t('landing.tracking.status_pill')}
            </div>
            <span className='block text-xs font-medium uppercase tracking-widest text-[#999999] mb-3'>
              {t('landing.tracking.label')}
            </span>
            <h3 className='text-2xl md:text-3xl text-[#1a1a1a] mb-5 leading-snug font-light'>
              {t('landing.tracking.heading_pre')}{' '}
              <em className='italic'>{t('landing.tracking.heading_accent')}</em>
            </h3>
            <p className='text-[#6b6b6b] leading-relaxed mb-4'>{t('landing.tracking.p1')}</p>
            <p className='text-[#6b6b6b] leading-relaxed mb-6'>{t('landing.tracking.p2')}</p>
            <Link to='/admin' className='inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:underline underline-offset-4'>
              {t('landing.tracking.cta')}
            </Link>
          </Reveal>

          <Reveal delay={0.15}>
            <div style={{ perspective: '1000px' }}>
              <TiltCard intensity={5}>
                <div
                  className='rounded-2xl border border-[#e8e6e3] overflow-hidden'
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: 'rotateX(-5deg)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.09), 0 4px 16px rgba(0,0,0,0.05)',
                  }}
                >
                  <div className='bg-[#f5f4f2] border-b border-[#e8e6e3] px-4 py-3 flex items-center justify-between'>
                    <p className='text-xs text-[#999999] font-medium'>{t('landing.tracking.live_activity')}</p>
                    <span className='flex items-center gap-1.5 text-[10px] text-green-500 font-medium'>
                      <motion.span
                        className='w-1.5 h-1.5 rounded-full bg-green-500 inline-block'
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      {t('landing.tracking.live')}
                    </span>
                  </div>
                  <div className='divide-y divide-[#f0eeeb]' style={{ transform: 'translateZ(10px)' }}>
                    {NOTIFICATION_KEYS.map((n, idx) => (
                      <motion.div
                        key={n.titleKey}
                        className='flex items-start gap-3 p-4 bg-white hover:bg-[#fafaf9] transition-colors'
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + idx * 0.12, duration: 0.5 }}
                      >
                        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${n.dot}`} />
                        <div>
                          <p className='text-sm font-medium text-[#1a1a1a]'>{t(n.titleKey)}</p>
                          <p className='text-xs text-[#999999] mt-0.5'>{t(n.subKey)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </TiltCard>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Client Experience — dark section with phone mockup                  */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-28 px-6 bg-[#080808] relative overflow-hidden'>
        <Orb className='w-[500px] h-[500px] bg-[#E7B8B5]/10 top-[-15%] right-[-10%]' delay={0.5} />
        <Orb className='w-[400px] h-[400px] bg-[#a0b4e8]/08 bottom-[-10%] left-[-5%]' delay={2} />

        <div className='max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center'>
          <Reveal>
            <span className='text-xs font-medium uppercase tracking-widest text-[#E7B8B5]/70 mb-3 block'>
              {t('landing.client.label')}
            </span>
            <h3 className='text-2xl md:text-3xl text-white mb-5 leading-snug font-light'>
              {t('landing.client.heading_pre')}{' '}
              <em className='italic' style={gradientText}>{t('landing.client.heading_accent')}</em>{' '}
              {t('landing.client.heading_post')}
            </h3>
            <ul className='space-y-3 mb-8'>
              {(
                ['landing.client.bullet1', 'landing.client.bullet2', 'landing.client.bullet3'] as const
              ).map((key) => (
                <li key={key} className='flex items-start gap-3 text-white/60 text-sm'>
                  <svg className='w-4 h-4 text-[#E7B8B5] mt-0.5 shrink-0' fill='none' stroke='currentColor' strokeWidth='2.5' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                  </svg>
                  {t(key)}
                </li>
              ))}
            </ul>
            <Link
              to='/admin'
              className='inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-[#0a0a0a] text-sm font-medium hover:bg-white/90 transition-colors'
            >
              {t('landing.client.cta')}
            </Link>
          </Reveal>

          {/* Phone mockup */}
          <Reveal delay={0.15} className='flex justify-center'>
            <div ref={phoneRef} style={{ perspective: '1200px' }}>
              <motion.div
                style={{ rotateY: phoneRotateY, rotateX: phoneRotateX, transformStyle: 'preserve-3d' }}
                className='relative w-[220px] rounded-[2.5rem] bg-[#0a0a0a] border-2 border-[#2a2a2a] shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)]'
              >
                <div className='absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-[#0a0a0a] rounded-b-2xl z-10 border-b-2 border-x-2 border-[#2a2a2a]' />
                <div className='m-1 rounded-[2.2rem] bg-white overflow-hidden' style={{ minHeight: '420px' }}>
                  <div className='pt-8 pb-2 px-4 bg-[#FAF8F4]'>
                    <div className='flex items-center gap-1.5 mb-1'>
                      <div className='w-4 h-4 rounded-full bg-[#E7B8B5]/40' />
                      <p className='text-[9px] font-semibold text-[#1a1a1a]'>{t('landing.phone.gallery')}</p>
                    </div>
                    <p className='text-[8px] text-[#999999]'>{t('landing.phone.session')}</p>
                  </div>
                  <div className='px-2 pb-4 bg-[#FAF8F4]'>
                    <div className='grid grid-cols-2 gap-1.5'>
                      {[
                        { h: 'h-20', g: 'from-[#e8ddd0] to-[#d4c5b2]', sel: true },
                        { h: 'h-14', g: 'from-[#d0dae8] to-[#b2c1d4]', sel: false },
                        { h: 'h-14', g: 'from-[#dde8d0] to-[#c5d4b2]', sel: false },
                        { h: 'h-20', g: 'from-[#e8d0d8] to-[#d4b2bf]', sel: true },
                        { h: 'h-16', g: 'from-[#d8d0e8] to-[#bfb2d4]', sel: true },
                        { h: 'h-16', g: 'from-[#e8e0d0] to-[#d4ccb2]', sel: false },
                      ].map((p, i) => (
                        <div key={i} className={`relative rounded-lg ${p.h} bg-gradient-to-br ${p.g} ${p.sel ? 'ring-1 ring-[#E7B8B5]' : 'opacity-70'}`}>
                          {p.sel && (
                            <div className='absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#E7B8B5] flex items-center justify-center'>
                              <svg className='w-2 h-2 text-white' fill='none' stroke='currentColor' strokeWidth='3' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                              </svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className='mt-3 mx-1 rounded-xl bg-[#E7B8B5] py-2 flex items-center justify-center'>
                      <span className='text-[9px] font-semibold text-white'>{t('landing.phone.submit')}</span>
                    </div>
                  </div>
                </div>
                <div className='flex justify-center py-2'>
                  <div className='w-14 h-1 rounded-full bg-white/20' />
                </div>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SPLIT — Portfolio / Brand with 3D theme switcher                    */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-28 px-6 bg-[#fafaf9]'>
        <div className='max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center'>
          {/* 3D theme switcher */}
          <Reveal delay={0.15} className='order-2 md:order-1 flex justify-center'>
            <div
              className='relative w-64 h-48 cursor-pointer'
              style={{ perspective: '900px' }}
              onMouseEnter={() => setThemeHovered(true)}
              onMouseLeave={() => setThemeHovered(false)}
            >
              {THEMES.map((theme, i) => {
                const baseAngles   = [-15, 0, 15];
                const hoveredAngles = [-28, 0, 28];
                const baseZ        = [-20, 0, -20];
                const hoveredZ     = [-30, 20, -30];
                return (
                  <motion.div
                    key={theme.nameKey}
                    className='absolute inset-0 rounded-2xl border flex flex-col justify-between p-4'
                    style={{ backgroundColor: theme.color, borderColor: theme.accent + '40', transformStyle: 'preserve-3d' }}
                    animate={{
                      rotateY:    themeHovered ? hoveredAngles[i] : baseAngles[i],
                      translateZ: themeHovered ? hoveredZ[i] : baseZ[i],
                      opacity:    i === 1 ? 1 : themeHovered ? 0.9 : 0.7,
                      scale:      i === 1 ? 1 : themeHovered ? 0.95 : 0.9,
                    }}
                    transition={{ type: 'spring', stiffness: 160, damping: 20 }}
                  >
                    <span className='text-[10px] font-semibold uppercase tracking-widest' style={{ color: theme.accent }}>
                      {theme.nameKey} {t('landing.brand.theme_suffix')}
                    </span>
                    <div className='space-y-1.5'>
                      <div className='h-2 rounded-full opacity-30' style={{ background: theme.accent, width: '60%' }} />
                      <div className='h-2 rounded-full opacity-20' style={{ background: theme.accent, width: '80%' }} />
                      <div className='h-2 rounded-full opacity-15' style={{ background: theme.accent, width: '45%' }} />
                    </div>
                    <div className='grid grid-cols-3 gap-1'>
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className='aspect-square rounded-md opacity-25' style={{ background: theme.accent }} />
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Reveal>

          <Reveal className='order-1 md:order-2'>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>{t('landing.brand.label')}</span>
            <h3 className='text-2xl md:text-3xl text-[#1a1a1a] mt-3 mb-5 leading-snug font-light'>
              {t('landing.brand.heading_pre')}{' '}
              <em className='italic'>{t('landing.brand.heading_accent')}</em>
            </h3>
            <p className='text-[#6b6b6b] leading-relaxed mb-6'>{t('landing.brand.desc')}</p>
            <Link to='/admin' className='inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:underline underline-offset-4'>
              {t('landing.brand.cta')}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SPLIT — Products                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id='products' className='py-28 px-6 bg-white'>
        <div className='max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center'>
          <Reveal>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>{t('landing.products.label')}</span>
            <h3 className='text-2xl md:text-3xl text-[#1a1a1a] mt-3 mb-5 leading-snug font-light'>
              {t('landing.products.heading_pre')}{' '}
              <em className='italic'>{t('landing.products.heading_accent')}</em>
            </h3>
            <p className='text-[#6b6b6b] leading-relaxed mb-6'>{t('landing.products.desc')}</p>
            <Link to='/admin' className='inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:underline underline-offset-4'>
              {t('landing.products.cta')}
            </Link>
          </Reveal>

          <Reveal delay={0.15}>
            <TiltCard intensity={6}>
              <div className='grid grid-cols-3 gap-4' style={{ transformStyle: 'preserve-3d' }}>
                {PRODUCT_KEYS.map((p) => (
                  <motion.div
                    key={p.labelKey}
                    className={`rounded-2xl bg-gradient-to-br ${p.grad} aspect-[3/4] flex flex-col items-start justify-end p-3 shadow-lg`}
                    style={{ transform: `translateZ(${p.z}px)` }}
                    whileHover={{ y: -8, scale: 1.04 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  >
                    <span className='text-xs font-semibold text-white/90 drop-shadow block'>{t(p.labelKey)}</span>
                    <span
                      className='text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-md inline-block'
                      style={{ background: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.95)' }}
                    >
                      {p.price}
                    </span>
                  </motion.div>
                ))}
              </div>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* BILINGUAL toggle                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-24 px-6 bg-[#fafaf9]'>
        <div className='max-w-xl mx-auto text-center'>
          <Reveal>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>{t('landing.bilingual.label')}</span>
            <div className='flex items-center justify-center gap-2 mt-5 mb-6'>
              <motion.button
                onClick={toggleLang}
                className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
                  lang === 'en'
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                    : 'bg-white text-[#6b6b6b] border-[#e8e6e3] hover:bg-[#f5f4f2]'
                }`}
                whileTap={{ scale: 0.96 }}
              >
                {t('landing.bilingual.en')}
              </motion.button>
              <motion.button
                onClick={toggleLang}
                className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
                  lang === 'he'
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                    : 'bg-white text-[#6b6b6b] border-[#e8e6e3] hover:bg-[#f5f4f2]'
                }`}
                whileTap={{ scale: 0.96 }}
              >
                {t('landing.bilingual.he')}
              </motion.button>
            </div>
            <p className='text-[#6b6b6b] leading-relaxed'>{t('landing.bilingual.desc')}</p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* TESTIMONIALS — glass morphism dark cards                            */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-28 px-6 bg-[#0d0d0d] relative overflow-hidden'>
        <Orb className='w-[600px] h-[600px] bg-[#E7B8B5]/08 top-[-20%] left-[-10%]' delay={0} />
        <Orb className='w-[400px] h-[400px] bg-[#a0b4e8]/06 bottom-[-10%] right-[-5%]' delay={2} />

        <div className='max-w-6xl mx-auto'>
          <Reveal className='text-center mb-16'>
            <span className='text-xs font-medium uppercase tracking-widest text-white/30'>{t('landing.testimonials.label')}</span>
            <h2 className='text-3xl md:text-4xl text-white mt-3 leading-snug font-light'>
              {t('landing.testimonials.heading_pre')}{' '}
              <em className='italic' style={gradientText}>Koral</em>
            </h2>
          </Reveal>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {TESTIMONIAL_KEYS.map((testimonial, i) => (
              <Reveal key={testimonial.nameKey} delay={i * 0.1}>
                <TiltCard className='h-full' intensity={7}>
                  <div
                    className='p-6 rounded-2xl border border-white/10 h-full flex flex-col justify-between'
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      transformStyle: 'preserve-3d',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div>
                      <div
                        className='text-4xl leading-none mb-4 font-serif'
                        style={{ color: '#E7B8B5', opacity: 0.6, transform: 'translateZ(12px)' }}
                      >
                        "
                      </div>
                      <p className='text-white/70 text-sm leading-relaxed italic' style={{ transform: 'translateZ(8px)' }}>
                        {t(testimonial.quoteKey)}
                      </p>
                    </div>
                    <div className='flex items-center gap-3 mt-6' style={{ transform: 'translateZ(16px)' }}>
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${testimonial.grad} shrink-0`} />
                      <div>
                        <p className='text-white text-sm font-medium'>{t(testimonial.nameKey)}</p>
                        <p className='text-white/40 text-xs'>{t(testimonial.roleKey)}</p>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA — dark 3D                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className='relative py-36 px-6 bg-[#080808] text-center overflow-hidden'>
        <Orb className='w-[500px] h-[500px] bg-[#E7B8B5]/15 top-[-20%] left-[10%]' />
        <Orb className='w-[400px] h-[400px] bg-[#a0b4e8]/12 bottom-[-10%] right-[5%]' delay={1.5} />
        <div
          className='absolute inset-0 opacity-[0.04] pointer-events-none'
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <Reveal>
          <h2 className='text-4xl md:text-6xl font-light text-white mb-5 leading-tight'>
            {t('landing.cta.heading_pre')}
            <br />
            <em className='italic' style={gradientText}>
              {t('landing.cta.heading_accent')}
            </em>
          </h2>
          <p className='text-white/50 mb-10 max-w-lg mx-auto leading-relaxed'>
            {t('landing.cta.desc')}
          </p>
          <div className='flex flex-col sm:flex-row gap-3 justify-center mb-6'>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                to='/admin'
                className='inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-[#0a0a0a] text-sm font-medium hover:bg-white/90 transition-colors'
              >
                {t('landing.cta.primary')}
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                to='/admin'
                className='inline-flex items-center justify-center px-8 py-3.5 rounded-xl border border-white/20 text-white/80 text-sm font-medium hover:bg-white/5 transition-colors'
              >
                {t('landing.cta.secondary')}
              </Link>
            </motion.div>
          </div>
          <p className='text-xs text-white/30'>{t('landing.cta.footnote')}</p>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className='border-t border-[#e8e6e3] bg-[#fafaf9] py-8 px-6'>
        <div className='max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4'>
          <span className='text-lg text-[#1a1a1a] font-medium'>Koral Light Studio</span>
          <nav className='flex flex-wrap justify-center gap-x-6 gap-y-2'>
            {[
              { labelKey: 'landing.nav.features',  href: '#features' },
              { labelKey: 'landing.footer.pricing', href: '#' },
              { labelKey: 'nav.blog',               href: '/blog' },
              { labelKey: 'landing.footer.support', href: '#' },
              { labelKey: 'landing.footer.privacy', href: '#' },
            ].map((l) =>
              l.href.startsWith('#') || l.href === '#' ? (
                <a key={l.labelKey} href={l.href} className='text-sm text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors'>
                  {t(l.labelKey)}
                </a>
              ) : (
                <Link key={l.labelKey} to={l.href} className='text-sm text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors'>
                  {t(l.labelKey)}
                </Link>
              ),
            )}
          </nav>
          <p className='text-xs text-[#999999]'>{t('landing.footer.copyright')}</p>
        </div>
      </footer>
    </div>
  );
};
