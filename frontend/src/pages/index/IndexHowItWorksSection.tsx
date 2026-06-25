import React, { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useI18n } from '../../lib/i18n';
import { PIPELINE } from './landingData';
import { Reveal, SectionLabel, SectionHeading, CtaButton } from './landingComponents';

interface IndexHowItWorksSectionProps {
  openRegister: () => void;
}

// The status pipeline is the product's real differentiator — photographers
// always lose track of who's at what stage. Render it as the section's
// centerpiece: an animated strip that lights up stage by stage.
function PipelineStrip() {
  const { lang, dir } = useI18n();
  const reduced = useReducedMotion();
  const isHe = lang === 'he';
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const lit = reduced || inView;

  return (
    <div ref={ref} className='rounded-2xl border border-[#E8E8EC] bg-white px-4 py-7 sm:px-8 overflow-x-auto'>
      <ol className='flex items-start min-w-[560px]' aria-label={isHe ? 'שלבי הגלריה' : 'Gallery stages'}>
        {PIPELINE.map((stage, i) => (
          <li key={stage.key} className='flex-1 flex items-start min-w-0'>
            <div className='flex flex-col items-center text-center w-16 sm:w-20 shrink-0'>
              <motion.span
                className='flex h-8 w-8 items-center justify-center rounded-full border-2 font-body text-xs font-semibold'
                initial={reduced ? false : { borderColor: '#E8E8EC', color: '#A0A0AA', backgroundColor: '#FFFFFF' }}
                animate={lit ? { borderColor: '#F5A623', color: '#FFFFFF', backgroundColor: '#F5A623' } : {}}
                transition={{ delay: reduced ? 0 : 0.35 * i, duration: 0.3 }}>
                {i + 1}
              </motion.span>
              <motion.span className='mt-2 font-body text-[11px] sm:text-xs leading-tight'
                initial={reduced ? false : { color: '#A0A0AA' }}
                animate={lit ? { color: '#111111' } : {}}
                transition={{ delay: reduced ? 0 : 0.35 * i + 0.1, duration: 0.3 }}>
                {isHe ? stage.he : stage.en}
              </motion.span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className='relative mt-4 h-0.5 flex-1 bg-[#E8E8EC] rounded-full overflow-hidden'>
                <motion.span className='absolute inset-0 bg-[#F5A623]'
                  style={{ transformOrigin: dir === 'rtl' ? 'right' : 'left' }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={lit ? { scaleX: 1 } : {}}
                  transition={{ delay: reduced ? 0 : 0.35 * i + 0.15, duration: 0.3, ease: 'easeOut' }} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function IndexHowItWorksSection({ openRegister }: IndexHowItWorksSectionProps) {
  const { lang } = useI18n();
  const isHe = lang === 'he';

  const steps = isHe
    ? [
        { stage: 'טיוטה → נשלחה', title: 'מעלים גלריה', desc: 'גוררים את התמונות. קישור פרטי נשלח ללקוח אוטומטית באימייל וב-SMS.' },
        { stage: 'נצפתה', title: 'הלקוח בוחר מהנייד', desc: 'בלי הרשמה ובלי סיסמה. בוחרים מועדפים, מסמנים תמונת נושא ומוסיפים הערות.' },
        { stage: 'בחירה הוגשה → בעריכה', title: 'מקבלים התראה ועורכים', desc: 'התראת פוש ברגע שהבחירה מוגשת. רשימה מסודרת של מה לערוך — בלי אקסל ובלי וואטסאפ.' },
        { stage: 'נמסרה', title: 'מוסרים ומוכרים', desc: 'גלריית מסירה עם התמונות הסופיות, וחנות הדפסות ואלבומים שהלקוח מזמין ממנה ישירות.' },
      ]
    : [
        { stage: 'Draft → Sent', title: 'Upload a gallery', desc: 'Drag in your photos. A private link goes out to your client automatically by email and SMS.' },
        { stage: 'Viewed', title: 'Client picks on their phone', desc: 'No signup, no password. They pick favorites, mark a hero image and leave comments.' },
        { stage: 'Selection in → In editing', title: 'Get notified, edit', desc: 'A push notification the moment the selection lands. A clean list of what to edit — no spreadsheets, no WhatsApp threads.' },
        { stage: 'Delivered', title: 'Deliver and sell', desc: 'A delivery gallery with the final photos, plus a print & album store your client orders from directly.' },
      ];

  return (
    <section id='how-it-works' className='bg-white py-24 px-6'>
      <div className='max-w-5xl mx-auto'>
        <Reveal className='text-center'>
          <SectionLabel>{isHe ? 'איך זה עובד' : 'How it works'}</SectionLabel>
          <SectionHeading className='mb-4'>
            {isHe ? 'מהצילום ועד המסירה — בלי לאבד אף לקוח בדרך.' : 'From shoot to delivery — without losing track of a single client.'}
          </SectionHeading>
          <p className='font-body text-[#5C5C66] max-w-xl mx-auto mb-12'>
            {isHe
              ? 'כל גלריה עוברת בצינור סטטוסים אחד, ואתם רואים בכל רגע מי בדיוק באיזה שלב.'
              : 'Every gallery moves through one status pipeline, so you always know exactly who is at what stage.'}
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <PipelineStrip />
        </Reveal>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5 mt-10'>
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={0.08 * i}>
              <div className='h-full rounded-2xl border border-[#E8E8EC] bg-white p-7'>
                <span className='inline-block rounded-full bg-[#FBF3E3] text-[#9A6A0B] font-body text-[11px] font-semibold px-3 py-1 mb-4'>
                  {step.stage}
                </span>
                <h3 className='font-display text-xl text-[#111111] mb-2'>{step.title}</h3>
                <p className='font-body text-sm leading-relaxed text-[#5C5C66]'>{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className='text-center mt-12' delay={0.2}>
          <CtaButton big onClick={openRegister}>{isHe ? 'התחל בחינם' : 'Start free'}</CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
