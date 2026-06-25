import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useI18n } from '../../lib/i18n';

interface NavLink {
  label: string;
  href: string;
}

interface IndexNavHeaderProps {
  navScrolled: boolean;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  openRegister: () => void;
  NAV_LINKS: NavLink[];
}

export function IndexNavHeader({ navScrolled, menuOpen, setMenuOpen, openRegister, NAV_LINKS }: IndexNavHeaderProps) {
  const { lang, dir, toggleLang } = useI18n();
  const reduced = useReducedMotion();
  const isHe = lang === 'he';

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${navScrolled ? 'bg-white/95 backdrop-blur border-b border-[#E8E8EC]' : 'bg-transparent'}`}>
        <div className='max-w-6xl mx-auto px-6 h-16 flex items-center justify-between'>
          <Link to='/' className='font-display text-lg tracking-[0.18em] text-[#111111]'>
            LIGHT STUDIO
          </Link>

          <nav className='hidden md:flex items-center gap-8' aria-label={isHe ? 'ניווט ראשי' : 'Main navigation'}>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}
                className='text-sm font-body text-[#5C5C66] hover:text-[#111111] transition-colors'>
                {l.label}
              </a>
            ))}
          </nav>

          <div className='flex items-center gap-3'>
            {/* Bilingual product — keep the switcher prominent */}
            <button onClick={toggleLang}
              className='inline-flex items-center gap-1.5 rounded-full border border-[#E8E8EC] px-3 py-1.5 text-xs font-body font-medium text-[#111111]
                hover:border-[#111111] transition-colors
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'
              aria-label={isHe ? 'Switch to English' : 'עבור לעברית'}>
              <svg className='w-3.5 h-3.5 text-[#5C5C66]' fill='none' stroke='currentColor' strokeWidth='1.8' viewBox='0 0 24 24' aria-hidden='true'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3 7.5 7.03 7.5 12s2.015 9 4.5 9zM3.6 9h16.8M3.6 15h16.8' />
              </svg>
              {isHe ? 'EN' : 'עברית'}
            </button>
            <Link to='/login' className='hidden sm:block text-sm font-body text-[#5C5C66] hover:text-[#111111] transition-colors'>
              {isHe ? 'כניסה' : 'Log in'}
            </Link>
            <button onClick={openRegister}
              className='hidden sm:inline-flex items-center px-5 py-2 rounded-full bg-[#111111] text-white text-sm font-body font-medium
                transition-transform duration-200 hover:scale-[1.03]
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'>
              {isHe ? 'התחל בחינם' : 'Start free'}
            </button>
            <button className='md:hidden p-2 text-[#111111]' onClick={() => setMenuOpen(true)}
              aria-label={isHe ? 'פתח תפריט' : 'Open menu'}>
              <svg className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24' aria-hidden='true'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 12h16M4 18h16' />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div className='fixed inset-0 z-[70] flex flex-col bg-white px-6 py-8'
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir === 'rtl' ? '-100%' : '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir === 'rtl' ? '-100%' : '100%' }}
            transition={{ duration: 0.25 }}>
            <div className='flex items-center justify-between mb-12'>
              <span className='font-display text-lg tracking-[0.18em] text-[#111111]'>LIGHT STUDIO</span>
              <button onClick={() => setMenuOpen(false)} className='p-1 text-[#5C5C66]' aria-label={isHe ? 'סגור תפריט' : 'Close menu'}>
                <svg className='w-6 h-6' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24' aria-hidden='true'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
            <nav className='flex flex-col gap-6' aria-label={isHe ? 'ניווט ראשי' : 'Main navigation'}>
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                  className='font-display text-2xl text-[#111111]'>{l.label}</a>
              ))}
            </nav>
            <div className='mt-auto flex flex-col gap-3'>
              <button onClick={toggleLang}
                className='py-3 rounded-2xl border border-[#E8E8EC] text-sm font-body text-[#111111]'>
                {isHe ? 'English' : 'עברית'}
              </button>
              <button onClick={() => { setMenuOpen(false); openRegister(); }}
                className='py-4 rounded-2xl bg-[#111111] text-white font-body font-medium text-lg'>
                {isHe ? 'התחל בחינם' : 'Start free'}
              </button>
              <Link to='/login' onClick={() => setMenuOpen(false)}
                className='py-4 text-center rounded-2xl border border-[#E8E8EC] font-body text-[#5C5C66]'>
                {isHe ? 'כניסה' : 'Log in'}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
