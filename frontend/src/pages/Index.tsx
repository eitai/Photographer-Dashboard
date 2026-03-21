import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Scroll-reveal hook
// ---------------------------------------------------------------------------
function useReveal() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

// Wrapper component so each section can call the hook independently
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photo placeholder colours for the hero browser mockup
// ---------------------------------------------------------------------------
const PHOTO_GRADIENTS = [
  'bg-gradient-to-br from-[#e8ddd0] to-[#d4c5b2]', // p1
  'bg-gradient-to-br from-[#d0dae8] to-[#b2c1d4]', // p2
  'bg-gradient-to-br from-[#dde8d0] to-[#c5d4b2]', // p3
  'bg-gradient-to-br from-[#e8d0d8] to-[#d4b2bf]', // p4
  'bg-gradient-to-br from-[#d8d0e8] to-[#bfb2d4]', // p5
  'bg-gradient-to-br from-[#e8e0d0] to-[#d4ccb2]', // p6
  'bg-gradient-to-br from-[#d0e4e8] to-[#b2cfd4]', // p7
  'bg-gradient-to-br from-[#e2d0e8] to-[#ccb2d4]', // p8
];

// Items that carry a "selected" checkmark (1-indexed)
const SELECTED_ITEMS = new Set([1, 3, 6, 8]);

// ---------------------------------------------------------------------------
// Feature cards
// ---------------------------------------------------------------------------
const FEATURES = [
  {
    icon: '🔗',
    title: 'Personal Gallery Links',
    desc: 'Each client receives a unique, branded gallery link — no accounts, no friction.',
  },
  {
    icon: '⚡',
    title: 'Real-time Selections',
    desc: 'Clients mark their favourite shots instantly; you see every choice the moment it happens.',
  },
  {
    icon: '📊',
    title: 'Full Client Tracking',
    desc: 'Follow every project from "Gallery Sent" through to "Delivered" in one clear pipeline.',
  },
  {
    icon: '🎨',
    title: '11 Portfolio Designs',
    desc: 'Choose from eleven themes — each one polished, responsive, and fully brandable.',
  },
  {
    icon: '📦',
    title: 'Product Orders',
    desc: 'Sell albums, prints, and canvases directly through the platform. No third-party cart.',
  },
  {
    icon: '🌐',
    title: 'Hebrew & English',
    desc: 'Full RTL/LTR support — every page, gallery, and notification in both languages.',
  },
];

// ---------------------------------------------------------------------------
// Workflow steps
// ---------------------------------------------------------------------------
const STEPS = [
  {
    n: '1',
    title: 'Upload',
    desc: 'Drag and drop your edited images. We handle optimisation, storage, and delivery automatically.',
  },
  {
    n: '2',
    title: 'Share',
    desc: 'Send the client a personalised gallery link — works on any device, no app required.',
  },
  {
    n: '3',
    title: 'Select',
    desc: 'Clients browse their private gallery and mark the photos they love at their own pace.',
  },
  {
    n: '4',
    title: 'Deliver',
    desc: 'Finalise edits, fulfil product orders, and mark the project delivered — all in one place.',
  },
];

// ---------------------------------------------------------------------------
// Notification cards (tracking split section)
// ---------------------------------------------------------------------------
const NOTIFICATIONS = [
  {
    dot: 'bg-green-500',
    title: 'Sarah selected 23 photos',
    sub: 'Wedding gallery · 2 min ago',
  },
  {
    dot: 'bg-blue-400',
    title: 'Tom viewed the gallery',
    sub: 'Portrait session · 18 min ago',
  },
  {
    dot: 'bg-orange-400',
    title: 'Anna submitted her selection',
    sub: 'Family shoot · 1 hr ago',
  },
];

// ---------------------------------------------------------------------------
// Nav links
// ---------------------------------------------------------------------------
const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#workflow' },
  { label: 'Galleries', href: '#galleries' },
  { label: 'Products', href: '#products' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const Index = () => {
  const [langActive, setLangActive] = useState<'en' | 'he'>('en');
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className='min-h-screen bg-white font-sans text-[#1a1a1a] antialiased'>
      {/* ------------------------------------------------------------------ */}
      {/* NAV                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          navScrolled
            ? 'bg-white/90 backdrop-blur-md border-b border-[#e8e6e3] shadow-sm'
            : 'bg-white/70 backdrop-blur-md border-b border-[#f0eeeb]'
        }`}
      >
        <div className='max-w-6xl mx-auto px-6 h-16 flex items-center justify-between'>
          {/* Logo */}
          <Link to='/' className=' text-xl text-[#1a1a1a] tracking-tight'>
            Light Studio
          </Link>

          {/* Center links — hidden on small screens */}
          <nav className='hidden md:flex items-center gap-8'>
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className='text-sm text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors'>
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right CTA */}
          <div className='flex items-center gap-4'>
            <Link to='/admin' className='text-sm text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors'>
              Log in
            </Link>
            <Link
              to='/admin'
              className='hidden sm:inline-flex items-center px-4 py-2 rounded-lg bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333] transition-colors'
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className='pt-36 pb-20 px-6 text-center bg-white'>
        <div className='max-w-3xl mx-auto'>
          {/* Badge */}
          <div className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5f4f2] border border-[#e8e6e3] text-xs text-[#6b6b6b] mb-8'>
            <span className='w-2 h-2 rounded-full bg-green-500 inline-block' />
            Now in early access
          </div>

          {/* Headline */}
          <h1 className=' text-4xl md:text-6xl text-[#1a1a1a] leading-[1.1] mb-6'>
            Gallery management
            <br />
            made <em className='italic'>beautifully</em> simple
          </h1>

          {/* Subtitle */}
          <p className='text-lg md:text-xl text-[#6b6b6b] font-light leading-relaxed mb-10 max-w-2xl mx-auto'>
            Upload galleries, share personalised links with clients, track selections in real time, and deliver exceptional experiences
            — all in one place.
          </p>

          {/* CTAs */}
          <div className='flex flex-col sm:flex-row gap-3 justify-center mb-16'>
            <Link
              to='/admin'
              className='inline-flex items-center justify-center px-7 py-3 rounded-lg bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333] transition-colors'
            >
              Start Free Trial
            </Link>
            <a
              href='#workflow'
              className='inline-flex items-center justify-center px-7 py-3 rounded-lg border border-[#e8e6e3] text-[#1a1a1a] text-sm font-medium hover:bg-[#fafaf9] transition-colors'
            >
              See How It Works
            </a>
          </div>

          {/* Browser mockup */}
          <div className='shadow-[0_24px_80px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.03)] rounded-xl border border-[#e8e6e3] overflow-hidden text-left'>
            {/* Chrome bar */}
            <div className='bg-[#f5f4f2] border-b border-[#e8e6e3] px-4 py-3 flex items-center gap-3'>
              <div className='flex gap-1.5'>
                <span className='w-3 h-3 rounded-full bg-[#e8e6e3]' />
                <span className='w-3 h-3 rounded-full bg-[#e8e6e3]' />
                <span className='w-3 h-3 rounded-full bg-[#e8e6e3]' />
              </div>
              <div className='flex-1 bg-white rounded-md px-3 py-1 text-xs text-[#999999] border border-[#e8e6e3] max-w-sm mx-auto text-center'>
                lightstudio.app/gallery/sarah-david-wedding
              </div>
            </div>

            {/* App body */}
            <div className='flex bg-white'>
              {/* Sidebar */}
              <aside className='hidden sm:flex flex-col w-48 shrink-0 border-r border-[#f0eeeb] p-4 bg-[#fafaf9]'>
                <p className=' text-sm text-[#1a1a1a] mb-1'>Sarah &amp; David</p>
                <p className='text-[11px] text-[#999999] mb-4'>Wedding · Jun 2026</p>
                <div className='space-y-2'>
                  {[
                    { label: 'Total photos', value: '248' },
                    { label: 'Selected', value: '23' },
                    { label: 'Status', value: 'Reviewing' },
                  ].map((stat) => (
                    <div key={stat.label} className='flex justify-between text-[11px]'>
                      <span className='text-[#999999]'>{stat.label}</span>
                      <span className='font-medium text-[#1a1a1a]'>{stat.value}</span>
                    </div>
                  ))}
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
                        className={`relative aspect-square rounded-md ${grad} ${isSelected ? 'ring-2 ring-[#1a1a1a]' : ''}`}
                      >
                        {isSelected && (
                          <div className='absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#1a1a1a] flex items-center justify-center'>
                            <svg
                              className='w-3 h-3 text-white'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth='2.5'
                              viewBox='0 0 24 24'
                            >
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
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SOCIAL PROOF BAR                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-8 border-y border-[#f0eeeb] bg-[#fafaf9]'>
        <div className='max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-10'>
          <p className='text-sm text-[#999999] whitespace-nowrap shrink-0'>Trusted by photographers worldwide</p>
          <div className='flex flex-wrap justify-center sm:justify-start gap-x-8 gap-y-2'>
            {['Wedding', 'Portrait', 'Family', 'Newborn', 'Events', 'Commercial'].map((tag) => (
              <span key={tag} className='text-sm font-medium text-[#6b6b6b]'>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FEATURES                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section id='features' className='py-24 px-6 bg-white'>
        <div className='max-w-6xl mx-auto'>
          <Reveal className='text-center mb-16'>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>Features</span>
            <h2 className=' text-3xl md:text-4xl text-[#1a1a1a] mt-3 leading-snug'>
              Everything you need to deliver <em className='italic'>exceptional</em> work
            </h2>
          </Reveal>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.07}>
                <div className='p-6 rounded-xl border border-[#e8e6e3] bg-white hover:border-[#d0cecc] hover:shadow-sm transition-all'>
                  <span className='text-2xl mb-4 block'>{f.icon}</span>
                  <h3 className='font-semibold text-[#1a1a1a] mb-2'>{f.title}</h3>
                  <p className='text-sm text-[#6b6b6b] leading-relaxed'>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* WORKFLOW                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section id='workflow' className='py-24 px-6 bg-[#fafaf9]'>
        <div className='max-w-6xl mx-auto'>
          <Reveal className='text-center mb-16'>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>How It Works</span>
            <h2 className=' text-3xl md:text-4xl text-[#1a1a1a] mt-3 leading-snug'>
              From upload to delivery
              <br />
              in <em className='italic'>four</em> simple steps
            </h2>
          </Reveal>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8'>
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.1}>
                <div className='flex flex-col items-start'>
                  <div className='w-10 h-10 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-sm font-semibold mb-4'>
                    {step.n}
                  </div>
                  <h3 className='font-semibold text-[#1a1a1a] mb-2'>{step.title}</h3>
                  <p className='text-sm text-[#6b6b6b] leading-relaxed'>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SPLIT — Real-time Tracking                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id='galleries' className='py-24 px-6 bg-white'>
        <div className='max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center'>
          {/* Text */}
          <Reveal>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>Real-time Tracking</span>
            <h3 className=' text-2xl md:text-3xl text-[#1a1a1a] mt-3 mb-5 leading-snug'>
              Know exactly where every project <em className='italic'>stands</em>
            </h3>
            <p className='text-[#6b6b6b] leading-relaxed mb-6'>
              Live notifications keep you informed the moment a client views their gallery, makes a selection, or places a product
              order. No more chasing emails.
            </p>
            <Link
              to='/admin'
              className='inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:underline underline-offset-4'
            >
              See the dashboard →
            </Link>
          </Reveal>

          {/* Visual */}
          <Reveal delay={0.15}>
            <div className='rounded-xl border border-[#e8e6e3] overflow-hidden shadow-sm'>
              <div className='bg-[#f5f4f2] border-b border-[#e8e6e3] px-4 py-2.5'>
                <p className='text-xs text-[#999999] font-medium'>Activity</p>
              </div>
              <div className='divide-y divide-[#f0eeeb]'>
                {NOTIFICATIONS.map((n) => (
                  <div key={n.title} className='flex items-start gap-3 p-4'>
                    <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${n.dot}`} />
                    <div>
                      <p className='text-sm font-medium text-[#1a1a1a]'>{n.title}</p>
                      <p className='text-xs text-[#999999] mt-0.5'>{n.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SPLIT — Portfolio / Your Brand                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-24 px-6 bg-[#fafaf9]'>
        <div className='max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center'>
          {/* Visual first on desktop via order */}
          <Reveal delay={0.15} className='order-2 md:order-1'>
            <div className='grid grid-cols-2 gap-3'>
              {[
                'bg-gradient-to-br from-[#e8ddd0] to-[#d4c5b2]',
                'bg-gradient-to-br from-[#d0dae8] to-[#b2c1d4]',
                'bg-gradient-to-br from-[#dde8d0] to-[#c5d4b2]',
                'bg-gradient-to-br from-[#e8d0d8] to-[#d4b2bf]',
              ].map((g, i) => (
                <div key={i} className={`aspect-square rounded-lg ${g}`} />
              ))}
            </div>
          </Reveal>

          {/* Text */}
          <Reveal className='order-1 md:order-2'>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>Your Brand</span>
            <h3 className=' text-2xl md:text-3xl text-[#1a1a1a] mt-3 mb-5 leading-snug'>
              A portfolio page that feels <em className='italic'>truly yours</em>
            </h3>
            <p className='text-[#6b6b6b] leading-relaxed mb-6'>
              Pick from eleven hand-crafted themes and customise colours, fonts, and copy. Your public page is live in minutes — no
              designers, no code.
            </p>
            <Link
              to='/admin'
              className='inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:underline underline-offset-4'
            >
              Explore themes →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SPLIT — Products                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id='products' className='py-24 px-6 bg-white'>
        <div className='max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center'>
          {/* Text */}
          <Reveal>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>Sell Products</span>
            <h3 className=' text-2xl md:text-3xl text-[#1a1a1a] mt-3 mb-5 leading-snug'>
              Albums, prints &amp; canvases — <em className='italic'>built in</em>
            </h3>
            <p className='text-[#6b6b6b] leading-relaxed mb-6'>
              Offer physical products directly inside the client gallery. Clients choose, you fulfil — no third-party integrations, no
              extra subscriptions.
            </p>
            <Link
              to='/admin'
              className='inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] hover:underline underline-offset-4'
            >
              See product options →
            </Link>
          </Reveal>

          {/* Visual */}
          <Reveal delay={0.15}>
            <div className='grid grid-cols-3 gap-4'>
              {[
                { label: 'Albums', grad: 'from-[#e8ddd0] to-[#c5b49a]' },
                { label: 'Prints', grad: 'from-[#d0dae8] to-[#9aaec5]' },
                { label: 'Canvas', grad: 'from-[#dde8d0] to-[#a8c59a]' },
              ].map((p) => (
                <div key={p.label} className={`rounded-xl bg-gradient-to-br ${p.grad} aspect-[3/4] flex items-end p-3`}>
                  <span className='text-xs font-semibold text-white/90 drop-shadow'>{p.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* BILINGUAL                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-24 px-6 bg-[#fafaf9]'>
        <div className='max-w-xl mx-auto text-center'>
          <Reveal>
            <span className='text-xs font-medium uppercase tracking-widest text-[#999999]'>Language Support</span>
            <div className='flex items-center justify-center gap-2 mt-5 mb-6'>
              <button
                onClick={() => setLangActive('en')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  langActive === 'en'
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                    : 'bg-white text-[#6b6b6b] border-[#e8e6e3] hover:bg-[#f5f4f2]'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLangActive('he')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  langActive === 'he'
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                    : 'bg-white text-[#6b6b6b] border-[#e8e6e3] hover:bg-[#f5f4f2]'
                }`}
              >
                עברית
              </button>
            </div>
            <p className='text-[#6b6b6b] leading-relaxed'>
              Full native support — interface, galleries, and client pages in both languages.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className='py-28 px-6 bg-white text-center'>
        <Reveal>
          <h2 className=' text-3xl md:text-5xl text-[#1a1a1a] mb-5 leading-tight'>
            Ready to simplify your
            <br />
            <em className='italic'>gallery workflow?</em>
          </h2>
          <p className='text-[#6b6b6b] mb-10 max-w-lg mx-auto leading-relaxed'>
            Join photographers who deliver better client experiences with Light Studio.
          </p>
          <div className='flex flex-col sm:flex-row gap-3 justify-center mb-6'>
            <Link
              to='/admin'
              className='inline-flex items-center justify-center px-7 py-3 rounded-lg bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333] transition-colors'
            >
              Get Started Free
            </Link>
            <Link
              to='/admin'
              className='inline-flex items-center justify-center px-7 py-3 rounded-lg border border-[#e8e6e3] text-[#1a1a1a] text-sm font-medium hover:bg-[#fafaf9] transition-colors'
            >
              Book a Demo
            </Link>
          </div>
          <p className='text-xs text-[#999999]'>Free forever. No credit card required.</p>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className='border-t border-[#e8e6e3] bg-[#fafaf9] py-8 px-6'>
        <div className='max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4'>
          {/* Logo */}
          <span className=' text-lg text-[#1a1a1a]'>Light Studio</span>

          {/* Links */}
          <nav className='flex flex-wrap justify-center gap-x-6 gap-y-2'>
            {[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#' },
              { label: 'Blog', href: '/blog' },
              { label: 'Support', href: '#' },
              { label: 'Privacy', href: '#' },
            ].map((l) =>
              l.href.startsWith('#') || l.href === '#' ? (
                <a key={l.label} href={l.href} className='text-sm text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors'>
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} to={l.href} className='text-sm text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors'>
                  {l.label}
                </Link>
              ),
            )}
          </nav>

          {/* Copyright */}
          <p className='text-xs text-[#999999]'>© 2026 Light Studio</p>
        </div>
      </footer>
    </div>
  );
};
