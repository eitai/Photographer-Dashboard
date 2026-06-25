import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { SIGNUP_ROUTE } from './landingData';
import { Reveal, SectionLabel, SectionHeading } from './landingComponents';

// Teaser only — the full live-plan table (from GET /api/plans) lives at /pricing.
export function IndexPricingTeaser() {
  const { t, lang } = useI18n();
  const isHe = lang === 'he';

  const highlights = [
    t('landing.pricing.unlimited_galleries'),
    t('landing.pricing.all_features'),
    t('landing.pricing.priority_support'),
  ];

  return (
    <section id='pricing' className='border-y border-[#E8E8EC] bg-[#FBFBFC] py-24 px-6'>
      <div className='max-w-2xl mx-auto text-center'>
        <Reveal>
          <SectionLabel>{t('landing.pricing.badge')}</SectionLabel>
          <SectionHeading className='mb-4'>
            {isHe ? 'מחיר בשקלים. בלי הפתעות בדולרים.' : 'Priced in shekels. No dollar surprises.'}
          </SectionHeading>
          <p className='font-body text-[#5C5C66] mb-8'>
            {isHe
              ? 'מתחילים בחינם, ומשדרגים רק כשצריך עוד מקום. חיוב מקומי דרך PayPlus.'
              : 'Start free and upgrade only when you need more storage. Local billing via PayPlus.'}
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ul className='flex flex-wrap justify-center gap-3 mb-10'>
            {highlights.map((item) => (
              <li key={item} className='flex items-center gap-2 rounded-full border border-[#E8E8EC] bg-white px-4 py-2 font-body text-sm text-[#5C5C66]'>
                <span className='text-[#F5A623]' aria-hidden='true'>✓</span>{item}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.15}>
          <div className='flex flex-col sm:flex-row items-center justify-center gap-3'>
            <Link to='/pricing'
              className='inline-flex items-center gap-2 rounded-full border border-[#111111] px-8 py-3.5 font-body text-sm font-medium text-[#111111]
                transition-colors hover:bg-[#111111] hover:text-white
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'>
              {isHe ? 'לכל החבילות והמחירים' : 'See all plans & prices'}
            </Link>
            <Link to={SIGNUP_ROUTE}
              className='inline-flex items-center gap-2 rounded-full bg-[#111111] px-8 py-3.5 font-body text-sm font-medium text-white
                transition-transform hover:scale-[1.03]
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]'>
              {t('landing.pricing.cta_free')}
            </Link>
          </div>
          <p className='mt-4 font-body text-xs text-[#5C5C66]'>{t('landing.pricing.fine_print')}</p>
        </Reveal>
      </div>
    </section>
  );
}
