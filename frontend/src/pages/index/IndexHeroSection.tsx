import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '../../lib/i18n';
import { HERO_GALLERY } from './landingData';
import { CtaButton, GhostButton, FlagHeart } from './landingComponents';

interface IndexHeroSectionProps {
  openRegister: () => void;
}

// Signature element: a live mini-gallery. Visitors tap photos to "select"
// them exactly like a client would, and the phone mockup mirrors the count.
export function IndexHeroSection({ openRegister }: IndexHeroSectionProps) {
  const { lang } = useI18n();
  const reduced = useReducedMotion();
  const isHe = lang === 'he';

  const [picked, setPicked] = useState<boolean[]>(HERO_GALLERY.map((p) => p.picked));
  const count = picked.filter(Boolean).length;

  function toggle(i: number) {
    setPicked((prev) => prev.map((v, j) => (j === i ? !v : v)));
  }

  const bullets = isHe
    ? ['עברית מלאה, מימין לשמאל', 'הלקוח בוחר בלי להירשם', 'אפליקציות לנייד — לך וללקוח', 'חנות הדפסות ואלבומים מובנית']
    : ['Full Hebrew & English, RTL native', 'Clients pick photos — no signup', 'Mobile apps for you and your clients', 'Built-in print & album store'];

  const enter = (delay: number) =>
    reduced
      ? {}
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <section className='relative bg-white pt-28 pb-16 px-6 overflow-hidden'>
      <div className='max-w-6xl mx-auto'>
        <div className='flex flex-col lg:flex-row items-center gap-12 lg:gap-16'>

          {/* Copy */}
          <div className='flex-1 min-w-0 lg:max-w-xl'>
            <motion.h1 {...enter(0.05)}
              className='font-display text-4xl sm:text-5xl lg:text-[3.6rem] leading-[1.12] text-[#111111] mb-6'>
              {isHe ? (
                <>גלריות, לקוחות וחנות הדפסות.<br />הכול במקום אחד, בעברית.</>
              ) : (
                <>Galleries, clients and a print store.<br />All in one place.</>
              )}
            </motion.h1>

            <motion.p {...enter(0.15)} className='font-body text-lg leading-relaxed text-[#5C5C66] mb-8 max-w-md'>
              {isHe
                ? 'מעלים גלריה ושולחים קישור פרטי. הלקוח בוחר תמונות מהנייד — בלי להירשם. אתם מקבלים התראה, עורכים, מוסרים ומוכרים הדפסות.'
                : 'Upload a gallery and share a private link. Your client picks favorites on their phone — no account needed. You get notified, edit, deliver and sell prints.'}
            </motion.p>

            <motion.ul {...enter(0.25)} className='space-y-2.5 mb-9'>
              {bullets.map((b) => (
                <li key={b} className='flex items-center gap-3 font-body text-sm text-[#111111]'>
                  <svg className='w-4 h-4 shrink-0 text-[#F5A623]' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
                    <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
                  </svg>
                  {b}
                </li>
              ))}
            </motion.ul>

            <motion.div {...enter(0.35)} className='flex flex-col sm:flex-row items-start gap-3'>
              <CtaButton big onClick={openRegister}>{isHe ? 'התחל בחינם' : 'Start free'}</CtaButton>
              <GhostButton href='#how-it-works'>{isHe ? 'איך זה עובד' : 'How it works'}</GhostButton>
            </motion.div>

            <motion.p {...enter(0.45)} className='font-body text-xs text-[#5C5C66] mt-5'>
              {isHe ? 'ללא כרטיס אשראי · ביטול בכל רגע' : 'No credit card · Cancel anytime'}
            </motion.p>
          </div>

          {/* Interactive mini-gallery in a desktop frame + phone mirror */}
          <motion.div className='flex-1 min-w-0 w-full max-w-xl'
            {...(reduced ? {} : { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } })}>
            <div className='relative'>

              {/* Desktop browser frame */}
              <div className='rounded-2xl border border-[#E8E8EC] bg-white shadow-[0_24px_60px_-24px_rgba(17,17,17,0.18)] overflow-hidden'>
                <div className='flex items-center gap-2 px-4 py-3 border-b border-[#E8E8EC]'>
                  <span className='w-2.5 h-2.5 rounded-full bg-[#E8E8EC]' />
                  <span className='w-2.5 h-2.5 rounded-full bg-[#E8E8EC]' />
                  <span className='w-2.5 h-2.5 rounded-full bg-[#E8E8EC]' />
                  <span className='ms-3 flex-1 truncate rounded-md bg-[#F6F6F8] px-3 py-1 text-[11px] font-body text-[#5C5C66] text-start' dir='ltr'>
                    lightstudio.co.il/gallery/…
                  </span>
                </div>

                <div className='px-4 pt-3 pb-1 flex items-center justify-between'>
                  <p className='font-body text-xs font-medium text-[#111111]'>
                    {isHe ? 'הגלריה של נועה ועומר' : 'Noa & Omer’s gallery'}
                  </p>
                  <p className='font-body text-xs text-[#9A6A0B] font-semibold' aria-live='polite'>
                    {isHe ? `${count} נבחרו` : `${count} selected`}
                  </p>
                </div>

                <div className='grid grid-cols-3 gap-1.5 p-3'>
                  {HERO_GALLERY.map((photo, i) => (
                    <button key={photo.src} onClick={() => toggle(i)}
                      aria-pressed={picked[i]}
                      aria-label={isHe ? `בחר תמונה ${i + 1}` : `Select photo ${i + 1}`}
                      className='group relative aspect-[4/5] overflow-hidden rounded-lg
                        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5A623]'>
                      <img src={photo.src} alt='' width={800} height={1000}
                        loading={i < 3 ? 'eager' : 'lazy'}
                        className={`w-full h-full object-cover transition duration-300 group-hover:scale-[1.04] ${picked[i] ? '' : 'group-hover:opacity-90'}`} />
                      <span className={`absolute inset-0 transition-opacity duration-200 ${picked[i] ? 'bg-[#111111]/10 ring-2 ring-inset ring-[#F5A623]' : 'bg-transparent'}`} />
                      <FlagHeart active={picked[i]} className='absolute top-2 end-2' />
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone mirror — overlaps the desktop frame */}
              <div className='absolute -bottom-6 -start-4 sm:-start-8 w-36 rounded-[1.4rem] border border-[#E8E8EC] bg-white shadow-[0_18px_40px_-18px_rgba(17,17,17,0.3)] p-2' aria-hidden='true'>
                <div className='rounded-[1rem] overflow-hidden border border-[#E8E8EC]'>
                  <img src={HERO_GALLERY[0].src} alt='' width={800} height={1000} className='w-full aspect-[4/5] object-cover' />
                  <div className='px-2.5 py-2 bg-white'>
                    <p className='font-body text-[10px] text-[#5C5C66]'>{isHe ? 'נבחרו' : 'Selected'}</p>
                    <p className='font-body text-sm font-semibold text-[#111111]'>{count}/6</p>
                    <div className='mt-1.5 rounded-full bg-[#111111] text-white text-center text-[10px] font-body py-1.5'>
                      {isHe ? 'שליחת בחירה' : 'Submit picks'}
                    </div>
                  </div>
                </div>
              </div>

              <p className='absolute -top-3 end-4 rounded-full bg-[#F5A623] text-[#111111] font-body text-[11px] font-semibold px-3 py-1 shadow-sm'>
                {isHe ? 'נסו — לחצו על תמונה' : 'Try it — tap a photo'}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
