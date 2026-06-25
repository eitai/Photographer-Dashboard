import React from 'react';
import { useI18n } from '../../lib/i18n';
import { PHOTOS, PIPELINE } from './landingData';
import { Reveal, SectionLabel, SectionHeading, FlagHeart } from './landingComponents';

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className='w-full max-w-[230px]'>
      <div className='rounded-[2rem] border border-[#E8E8EC] bg-white p-2.5 shadow-[0_24px_60px_-24px_rgba(17,17,17,0.25)]'>
        <div className='rounded-[1.5rem] overflow-hidden border border-[#E8E8EC] bg-white'>
          {children}
        </div>
      </div>
      <figcaption className='mt-3 text-center font-body text-sm text-[#5C5C66]'>{label}</figcaption>
    </figure>
  );
}

// PLACEHOLDER: replace with real App Store / Google Play badge images + links
// once the apps are published.
function StoreBadge({ store }: { store: 'apple' | 'google' }) {
  return (
    <span className='inline-flex h-11 w-36 items-center justify-center rounded-lg border border-dashed border-[#D8D8DE] font-body text-xs text-[#A0A0AA]'>
      {store === 'apple' ? '[App Store]' : '[Google Play]'}
    </span>
  );
}

export function IndexMobileApps() {
  const { lang } = useI18n();
  const isHe = lang === 'he';

  return (
    <section id='apps' className='border-y border-[#E8E8EC] bg-[#FBFBFC] py-24 px-6'>
      <div className='max-w-5xl mx-auto'>
        <Reveal className='text-center mb-14'>
          <SectionLabel>{isHe ? 'אפליקציות לנייד' : 'Mobile apps'}</SectionLabel>
          <SectionHeading className='mb-4'>
            {isHe ? 'העסק בכיס שלך. הגלריה בכיס של הלקוח.' : 'Your business in your pocket. Their gallery in theirs.'}
          </SectionHeading>
          <p className='font-body text-[#5C5C66] max-w-xl mx-auto'>
            {isHe
              ? 'אפליקציה לצלם לניהול גלריות, לקוחות והתראות — ואפליקציית גלריה ללקוח שרוצה חוויה משודרגת. גם בלי האפליקציה, הקישור עובד מכל דפדפן.'
              : 'A photographer app for galleries, clients and notifications — and a gallery app for clients who want the upgraded experience. Even without it, the link works in any browser.'}
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className='flex flex-wrap items-start justify-center gap-10 sm:gap-16'>
            {/* Photographer app */}
            <PhoneFrame label={isHe ? 'האפליקציה לצלם' : 'The photographer app'}>
              <div aria-hidden='true'>
                <div className='px-3 py-2.5 border-b border-[#E8E8EC]'>
                  <p className='font-body text-[11px] font-semibold text-[#111111]'>{isHe ? 'הגלריות שלי' : 'My galleries'}</p>
                </div>
                <div className='p-2.5 space-y-2'>
                  {[
                    { img: PHOTOS.wedding1, name: isHe ? 'נועה ועומר' : 'Noa & Omer', stage: 3 },
                    { img: PHOTOS.family1, name: isHe ? 'משפחת לוין' : 'The Levin family', stage: 5 },
                    { img: PHOTOS.newborn1, name: isHe ? 'ניובורן — ארי' : 'Newborn — Ari', stage: 1 },
                  ].map((g) => (
                    <div key={g.name} className='flex items-center gap-2 rounded-xl border border-[#E8E8EC] p-2'>
                      <img src={g.img} alt='' width={800} height={1000} loading='lazy' className='h-9 w-9 rounded-lg object-cover' />
                      <div className='min-w-0'>
                        <p className='truncate font-body text-[11px] font-medium text-[#111111]'>{g.name}</p>
                        <p className='font-body text-[10px] text-[#F5A623] font-semibold'>
                          {isHe ? PIPELINE[g.stage].he : PIPELINE[g.stage].en}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className='rounded-xl bg-[#111111] py-2 text-center font-body text-[11px] text-white'>
                    {isHe ? '+ גלריה חדשה' : '+ New gallery'}
                  </div>
                </div>
              </div>
            </PhoneFrame>

            {/* Client app */}
            <PhoneFrame label={isHe ? 'חוויית הלקוח' : 'The client experience'}>
              <div aria-hidden='true'>
                <div className='relative'>
                  <img src={PHOTOS.maternity1} alt='' width={800} height={1000} loading='lazy' className='w-full aspect-[4/5] object-cover' />
                  <FlagHeart active className='absolute top-2 end-2' />
                </div>
                <div className='grid grid-cols-3 gap-1 p-1'>
                  {[PHOTOS.couple1, PHOTOS.portrait1, PHOTOS.wedding2].map((src) => (
                    <img key={src} src={src} alt='' width={800} height={1000} loading='lazy' className='aspect-square w-full rounded-sm object-cover' />
                  ))}
                </div>
                <div className='px-3 pb-3 pt-1'>
                  <div className='rounded-full bg-[#F5A623] py-2 text-center font-body text-[11px] font-medium text-white'>
                    {isHe ? 'שליחת הבחירה שלי' : 'Submit my picks'}
                  </div>
                </div>
              </div>
            </PhoneFrame>
          </div>
        </Reveal>

        <Reveal className='mt-12 flex flex-wrap items-center justify-center gap-4' delay={0.15}>
          <StoreBadge store='apple' />
          <StoreBadge store='google' />
        </Reveal>
      </div>
    </section>
  );
}
