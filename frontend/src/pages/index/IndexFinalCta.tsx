import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { PHOTOS } from './landingData';
import { Reveal } from './landingComponents';

interface NavLink {
  label: string;
  href: string;
}

interface IndexFinalCtaProps {
  openRegister: () => void;
  NAV_LINKS: NavLink[];
}

export function IndexFinalCta({ openRegister, NAV_LINKS }: IndexFinalCtaProps) {
  const { lang, toggleLang } = useI18n();
  const isHe = lang === 'he';

  return (
    <>
      <section className='relative overflow-hidden px-6 py-28'>
        <div className='absolute inset-0'>
          <img src={PHOTOS.banner1} alt='' width={1600} height={1067} loading='lazy' className='h-full w-full object-cover' />
          <div className='absolute inset-0 bg-[#111111]/70' />
        </div>
        <div className='relative z-10 mx-auto max-w-3xl text-center'>
          <Reveal>
            <h2 className='font-display text-3xl md:text-5xl leading-tight text-white mb-5'>
              {isHe ? 'הגלריה הבאה שלך כבר יכולה לצאת היום.' : 'Your next gallery could go out today.'}
            </h2>
            <p className='font-body text-white/75 text-lg mb-9 max-w-lg mx-auto'>
              {isHe
                ? 'פותחים חשבון, מעלים גלריה ושולחים קישור — תוך דקות, בחינם.'
                : 'Open an account, upload a gallery and send the link — within minutes, free.'}
            </p>
            <div className='flex flex-col sm:flex-row justify-center gap-3'>
              <button onClick={openRegister}
                className='inline-flex items-center justify-center gap-2 rounded-full bg-white px-10 py-4 font-body text-base font-medium text-[#111111]
                  transition-transform hover:scale-[1.03]
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'>
                {isHe ? 'התחל בחינם' : 'Start free'}
                <svg className='h-4 w-4 rtl:rotate-180' fill='none' stroke='currentColor' strokeWidth='2.5' viewBox='0 0 24 24' aria-hidden='true'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M13 7l5 5m0 0l-5 5m5-5H6' />
                </svg>
              </button>
              <Link to='/login'
                className='inline-flex items-center justify-center rounded-full border border-white/40 px-10 py-4 font-body text-base text-white/85
                  transition-colors hover:border-white hover:text-white
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'>
                {isHe ? 'יש לי חשבון' : 'I have an account'}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className='border-t border-[#E8E8EC] bg-white px-6 py-12'>
        <div className='mx-auto max-w-6xl'>
          <div className='flex flex-col gap-8 md:flex-row md:items-start md:justify-between'>
            <div>
              <p className='font-display text-lg tracking-[0.18em] text-[#111111]'>LIGHT STUDIO</p>
              <p className='mt-2 font-body text-sm text-[#5C5C66]'>
                {isHe ? 'פלטפורמת גלריות ולקוחות לצלמים.' : 'The gallery & client platform for photographers.'}
              </p>
              <button onClick={toggleLang}
                className='mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#E8E8EC] px-3 py-1.5 font-body text-xs font-medium text-[#111111] hover:border-[#111111] transition-colors'>
                {isHe ? 'English' : 'עברית'}
              </button>
            </div>

            <nav className='flex flex-col gap-2.5' aria-label={isHe ? 'קישורים' : 'Links'}>
              <p className='font-body text-xs font-semibold uppercase tracking-wider text-[#5C5C66]'>{isHe ? 'ניווט' : 'Navigate'}</p>
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className='font-body text-sm text-[#5C5C66] hover:text-[#111111] transition-colors'>{l.label}</a>
              ))}
              <Link to='/pricing' className='font-body text-sm text-[#5C5C66] hover:text-[#111111] transition-colors'>{isHe ? 'כל החבילות' : 'All plans'}</Link>
              <Link to='/login' className='font-body text-sm text-[#5C5C66] hover:text-[#111111] transition-colors'>{isHe ? 'כניסה' : 'Log in'}</Link>
            </nav>

            <div className='flex flex-col gap-2.5'>
              <p className='font-body text-xs font-semibold uppercase tracking-wider text-[#5C5C66]'>{isHe ? 'יצירת קשר' : 'Contact'}</p>
              <a href='mailto:hello@lightstudio.co.il' className='font-body text-sm text-[#5C5C66] hover:text-[#111111] transition-colors' dir='ltr'>
                hello@lightstudio.co.il
              </a>
              {/* PLACEHOLDER links — point to real terms/privacy pages before launch */}
              <a href='#' className='font-body text-sm text-[#5C5C66] hover:text-[#111111] transition-colors'>
                {isHe ? 'תנאי שימוש [בקרוב]' : 'Terms of service [TBD]'}
              </a>
              <a href='#' className='font-body text-sm text-[#5C5C66] hover:text-[#111111] transition-colors'>
                {isHe ? 'מדיניות פרטיות [בקרוב]' : 'Privacy policy [TBD]'}
              </a>
            </div>
          </div>

          <p className='mt-10 border-t border-[#E8E8EC] pt-6 text-center font-body text-xs text-[#5C5C66]'>
            © {new Date().getFullYear()} Light Studio. {isHe ? 'כל הזכויות שמורות.' : 'All rights reserved.'}
          </p>
        </div>
      </footer>
    </>
  );
}
