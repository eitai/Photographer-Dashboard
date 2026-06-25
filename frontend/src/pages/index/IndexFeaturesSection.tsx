import React from 'react';
import { useI18n } from '../../lib/i18n';
import { PHOTOS, PIPELINE } from './landingData';
import { Reveal, SectionLabel, SectionHeading, FlagHeart } from './landingComponents';

// Visual: two overlapping client-gallery photos with pick + comment overlays.
function ClientExperienceVisual({ isHe }: { isHe: boolean }) {
  return (
    <div className='relative mx-auto max-w-md py-6' aria-hidden='true'>
      <div className='w-3/4 rounded-2xl overflow-hidden border border-[#E8E8EC] shadow-[0_20px_50px_-20px_rgba(17,17,17,0.2)]'>
        <img src={PHOTOS.wedding2} alt='' width={800} height={1000} loading='lazy' className='w-full aspect-[4/5] object-cover' />
      </div>
      <div className='absolute bottom-0 end-0 w-1/2 rounded-2xl overflow-hidden border border-[#E8E8EC] shadow-[0_20px_50px_-20px_rgba(17,17,17,0.3)]'>
        <div className='relative'>
          <img src={PHOTOS.portrait2} alt='' width={800} height={1000} loading='lazy' className='w-full aspect-[4/5] object-cover' />
          <FlagHeart active className='absolute top-2 end-2' />
        </div>
      </div>
      <div className='absolute top-6 -start-2 sm:-start-6 max-w-[200px] rounded-xl border border-[#E8E8EC] bg-white px-4 py-3 shadow-md'>
        <p className='font-body text-[11px] text-[#5C5C66] mb-0.5'>{isHe ? 'הערה מהלקוח' : 'Client comment'}</p>
        <p className='font-body text-xs text-[#111111]'>{isHe ? '"את זאת בהגדלה על קנבס!"' : '“This one on canvas, please!”'}</p>
      </div>
    </div>
  );
}

// Visual: pipeline chips + a push notification + an order card.
function BusinessVisual({ isHe }: { isHe: boolean }) {
  return (
    <div className='mx-auto max-w-md space-y-3 py-6' aria-hidden='true'>
      <div className='rounded-xl border border-[#E8E8EC] bg-white p-4 shadow-sm'>
        <div className='flex flex-wrap gap-1.5'>
          {PIPELINE.map((s, i) => (
            <span key={s.key}
              className={`rounded-full px-2.5 py-1 font-body text-[11px] font-medium ${i === 3 ? 'bg-[#F5A623] text-white' : 'bg-[#F6F6F8] text-[#5C5C66]'}`}>
              {isHe ? s.he : s.en}
            </span>
          ))}
        </div>
        <p className='mt-3 font-body text-xs text-[#5C5C66]'>
          {isHe ? '3 גלריות ממתינות לבחירת לקוח · 1 בעריכה' : '3 galleries awaiting client picks · 1 in editing'}
        </p>
      </div>
      <div className='rounded-xl border border-[#E8E8EC] bg-white p-4 shadow-sm flex items-start gap-3'>
        <span className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white'>
          <svg className='w-4 h-4' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' />
          </svg>
        </span>
        <div>
          <p className='font-body text-xs font-semibold text-[#111111]'>{isHe ? 'נועה הגישה בחירה' : 'Noa submitted her picks'}</p>
          <p className='font-body text-xs text-[#5C5C66]'>{isHe ? '42 תמונות נבחרו · לפני רגע' : '42 photos selected · just now'}</p>
        </div>
      </div>
      <div className='rounded-xl border border-[#E8E8EC] bg-white p-4 shadow-sm flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <img src={PHOTOS.landscape1} alt='' width={800} height={533} loading='lazy' className='h-10 w-10 rounded-lg object-cover' />
          <div>
            <p className='font-body text-xs font-semibold text-[#111111]'>{isHe ? 'הזמנה: אלבום 30×30' : 'Order: 30×30 album'}</p>
            <p className='font-body text-xs text-[#5C5C66]'>{isHe ? 'ממתינה לבחירת תמונות' : 'Awaiting photo selection'}</p>
          </div>
        </div>
        <span className='rounded-full bg-[#FBF3E3] px-2.5 py-1 font-body text-[11px] font-semibold text-[#9A6A0B]'>
          {isHe ? 'חדש' : 'New'}
        </span>
      </div>
    </div>
  );
}

// Visual: portfolio-site mockup with the 11 theme swatches.
function BrandVisual({ isHe }: { isHe: boolean }) {
  const themeDots = ['#111111', '#8C6A4E', '#5C7458', '#33536B', '#7A4E5E', '#998A6B', '#3F3F46', '#6B4226', '#2F4F4F', '#586E75', '#A0A0AA'];
  return (
    <div className='mx-auto max-w-md py-6' aria-hidden='true'>
      <div className='rounded-2xl border border-[#E8E8EC] bg-white shadow-[0_20px_50px_-20px_rgba(17,17,17,0.2)] overflow-hidden'>
        <div className='flex items-center justify-between px-4 py-2.5 border-b border-[#E8E8EC]'>
          <span className='font-display text-xs tracking-[0.14em] text-[#111111]'>{isHe ? 'סטודיו נועה' : 'STUDIO NOA'}</span>
          <span className='font-body text-[10px] text-[#5C5C66]'>{isHe ? 'תיק עבודות · בלוג · צור קשר' : 'Portfolio · Blog · Contact'}</span>
        </div>
        <img src={PHOTOS.couple2} alt='' width={800} height={533} loading='lazy' className='w-full aspect-[16/9] object-cover' />
        <div className='grid grid-cols-3 gap-1 p-1'>
          {[PHOTOS.family1, PHOTOS.newborn1, PHOTOS.event1].map((src) => (
            <img key={src} src={src} alt='' width={800} height={800} loading='lazy' className='aspect-square w-full object-cover rounded-sm' />
          ))}
        </div>
      </div>
      <div className='mt-3 flex items-center gap-2 justify-center'>
        <span className='font-body text-[11px] text-[#5C5C66]'>{isHe ? '11 ערכות עיצוב:' : '11 themes:'}</span>
        {themeDots.map((c) => (
          <span key={c} className='h-3 w-3 rounded-full border border-white shadow-sm' style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  );
}

export function IndexFeaturesSection() {
  const { lang } = useI18n();
  const isHe = lang === 'he';

  const blocks = [
    {
      id: 'client-experience',
      label: isHe ? 'חוויית הלקוח' : 'Client experience',
      heading: isHe ? 'הלקוח פותח קישור — וזהו.' : 'Your client opens a link — that’s it.',
      body: isHe
        ? 'קישור פרטי ומאובטח, בלי הרשמה ובלי אפליקציה חובה. הלקוח מסמן מועדפים, בוחר תמונת נושא ומשאיר הערות על כל תמונה — והכול עובד מצוין מהנייד.'
        : 'A private, secure link. No signup, no required app. Clients flag favorites, pick a hero image and comment on any photo — and it all works beautifully on mobile.',
      points: isHe
        ? ['קישור פרטי לכל גלריה', 'מועדפים, הערות ותמונת נושא', 'מותאם לנייד מהפיקסל הראשון']
        : ['A private link per gallery', 'Favorites, comments & hero pick', 'Mobile-first from the first pixel'],
      visual: <ClientExperienceVisual isHe={isHe} />,
    },
    {
      id: 'your-business',
      label: isHe ? 'העסק שלך' : 'Your business',
      heading: isHe ? 'לדעת בכל רגע מי באיזה שלב.' : 'Always know who’s at what stage.',
      body: isHe
        ? 'צינור סטטוסים אחד לכל הלקוחות, התראת פוש ברגע שבחירה מוגשת, וחנות הדפסות ואלבומים שהופכת כל גלריה להכנסה נוספת.'
        : 'One status pipeline for every client, a push notification the moment a selection lands, and a print & album store that turns each gallery into extra revenue.',
      points: isHe
        ? ['צינור סטטוסים לכל גלריה', 'התראות פוש בזמן אמת', 'חנות מוצרים שהלקוח מזמין ממנה ישירות']
        : ['A status pipeline per gallery', 'Real-time push notifications', 'A store clients order from directly'],
      visual: <BusinessVisual isHe={isHe} />,
    },
    {
      id: 'your-brand',
      label: isHe ? 'המותג שלך' : 'Your brand',
      heading: isHe ? 'אתר שלם, בלי לבנות אתר.' : 'A full website, without building one.',
      body: isHe
        ? 'אתר תיק עבודות, בלוג עם עורך עשיר ועמוד נחיתה אישי עם 11 ערכות עיצוב, פיד אינסטגרם, המלצות וחבילות — הכול כלול, הכול בעברית.'
        : 'A portfolio site, a blog with a rich-text editor and a personal landing page with 11 themes, Instagram feed, testimonials and packages — all included, fully bilingual.',
      points: isHe
        ? ['תיק עבודות + בלוג מובנים', '11 ערכות עיצוב לעמוד הנחיתה', 'פיד אינסטגרם, המלצות וחבילות']
        : ['Built-in portfolio + blog', '11 landing page themes', 'Instagram feed, testimonials & packages'],
      visual: <BrandVisual isHe={isHe} />,
    },
  ];

  return (
    <section id='features' className='bg-white py-24 px-6'>
      <div className='max-w-6xl mx-auto space-y-24'>
        {blocks.map((block, i) => (
          <div key={block.id} className={`flex flex-col items-center gap-10 lg:gap-16 ${i % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
            <Reveal className='flex-1 min-w-0 lg:max-w-lg'>
              <SectionLabel>{block.label}</SectionLabel>
              <SectionHeading className='mb-5'>{block.heading}</SectionHeading>
              <p className='font-body text-[#5C5C66] leading-relaxed mb-7'>{block.body}</p>
              <ul className='space-y-3'>
                {block.points.map((p) => (
                  <li key={p} className='flex items-center gap-3 font-body text-sm text-[#111111]'>
                    <svg className='w-4 h-4 shrink-0 text-[#F5A623]' fill='currentColor' viewBox='0 0 20 20' aria-hidden='true'>
                      <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
                    </svg>
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal className='flex-1 min-w-0 w-full' delay={0.12}>
              {block.visual}
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}
