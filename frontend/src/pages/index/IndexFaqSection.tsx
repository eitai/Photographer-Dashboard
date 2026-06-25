import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useI18n } from '../../lib/i18n';
import { Reveal, SectionLabel, SectionHeading } from './landingComponents';

interface IndexFaqSectionProps {
  openFaq: number | null;
  setOpenFaq: (v: number | null) => void;
}

export function IndexFaqSection({ openFaq, setOpenFaq }: IndexFaqSectionProps) {
  const { lang } = useI18n();
  const reduced = useReducedMotion();
  const isHe = lang === 'he';

  const FAQ: { q: string; a: string }[] = isHe
    ? [
        {
          q: 'מה מגבלות האחסון?',
          a: 'כל חבילה כוללת נפח אחסון משלה, והתוכנית החינמית מספיקה כדי להתחיל ולהרגיש את המערכת. רואים את ניצול האחסון בכל רגע בלוח הבקרה, ומשדרגים רק כשבאמת צריך — כולל חבילה גמישה שמחושבת לפי נפח.',
        },
        {
          q: 'מה הלקוח שלי רואה? הוא צריך להירשם?',
          a: 'לא. הלקוח מקבל קישור פרטי באימייל או ב-SMS, פותח אותו מכל דפדפן — גם בנייד — ורואה גלריה נקייה עם התמונות שלו בלבד. הוא מסמן מועדפים, בוחר תמונת נושא, מוסיף הערות ושולח. בלי חשבון, בלי סיסמה, בלי אפליקציה חובה.',
        },
        {
          q: 'אני עובד היום עם Pixieset. איך עוברים?',
          a: 'פשוט: מורידים את הגלריות הפעילות מהמערכת הקיימת ומעלים אותן ל-Light Studio בגרירה — המערכת מסדרת תיקיות, ממזערת ויוצרת תצוגות מקדימות אוטומטית. לקוחות חדשים מקבלים קישור חדש, ואין צורך להעביר ארכיון ישן ביום אחד.',
        },
        {
          q: 'איך עובדת חנות ההדפסות ומי מדפיס בפועל?',
          a: 'אתם מגדירים מוצרים — אלבומים, הדפסות, קנבסים — והלקוח מזמין ובוחר תמונות ישירות מהגלריה שלו. הזמנות ההדפסה מבוצעות על ידי מעבדות מקצועיות, ואתם עוקבים אחרי כל הזמנה מלוח הבקרה.',
        },
        {
          q: 'איך מתבצע התשלום והחיוב?',
          a: 'החיוב בשקלים, דרך PayPlus — מערכת סליקה ישראלית. אפשר לשלם חודשי או שנתי (עם הנחה), והחשבונית מסודרת. אין חיובים בדולרים ואין הפתעות בשער ההמרה.',
        },
        {
          q: 'מה קורה אם אני רוצה לבטל?',
          a: 'מבטלים בכל רגע מעמוד החיוב, בלי טלפונים ובלי מכתבים. הגלריות נשארות זמינות עד סוף תקופת החיוב ששולמה, ותמיד אפשר להוריד את התמונות שלכם לפני שעוזבים.',
        },
      ]
    : [
        {
          q: 'What are the storage limits?',
          a: 'Each plan includes its own storage allowance, and the free plan is enough to get started and feel the system out. You can see your usage at any time in the dashboard and upgrade only when you actually need to — including a flexible plan priced by volume.',
        },
        {
          q: 'What does my client see? Do they need an account?',
          a: 'No. Your client gets a private link by email or SMS, opens it in any browser — including on mobile — and sees a clean gallery with only their photos. They flag favorites, pick a hero image, add comments and submit. No account, no password, no required app.',
        },
        {
          q: 'I currently use Pixieset. How do I migrate?',
          a: 'Simple: download your active galleries from your current platform and drag them into Light Studio — it organizes, optimizes and generates previews automatically. New clients get a new link, and there is no need to move your whole archive in one day.',
        },
        {
          q: 'How does the print store work, and who actually prints?',
          a: 'You define products — albums, prints, canvases — and your client orders and picks photos directly from their gallery. Print orders are fulfilled by professional labs, and you track every order from your dashboard.',
        },
        {
          q: 'How do payments and billing work?',
          a: 'Billing is in shekels via PayPlus, an Israeli payment provider. Pay monthly or annually (with a discount), with proper invoices. No dollar charges and no exchange-rate surprises.',
        },
        {
          q: 'What if I want to cancel?',
          a: 'Cancel any time from the billing page — no phone calls, no letters. Your galleries stay available until the end of the paid period, and you can always download your photos before you leave.',
        },
      ];

  return (
    <section id='faq' className='bg-white py-24 px-6'>
      <div className='max-w-2xl mx-auto'>
        <Reveal className='text-center mb-12'>
          <SectionLabel>{isHe ? 'שאלות נפוצות' : 'FAQ'}</SectionLabel>
          <SectionHeading>{isHe ? 'כל מה שחשוב לדעת.' : 'Everything you need to know.'}</SectionHeading>
        </Reveal>
        <div className='space-y-2'>
          {FAQ.map((item, i) => {
            const open = openFaq === i;
            return (
              <Reveal key={item.q} delay={0.04 * i}>
                <div className={`rounded-xl border bg-white transition-colors ${open ? 'border-[#111111]' : 'border-[#E8E8EC]'}`}>
                  <button
                    className='flex w-full items-center justify-between gap-4 px-6 py-4 text-start
                      focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] rounded-xl'
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}>
                    <span className='font-body text-sm font-medium text-[#111111]'>{item.q}</span>
                    <motion.svg animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduced ? 0 : 0.2 }}
                      className='h-4 w-4 shrink-0 text-[#5C5C66]'
                      fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24' aria-hidden='true'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
                    </motion.svg>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={reduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
                        animate={reduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                        exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className='overflow-hidden'>
                        <p className='border-t border-[#E8E8EC] px-6 pb-5 pt-4 font-body text-sm leading-relaxed text-[#5C5C66]'>
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
