import React from 'react';
import { useI18n } from '../../lib/i18n';
import { Reveal } from './landingComponents';

// PLACEHOLDER SECTION — no real logos or numbers yet.
// Replace the [logo] slots with real studio logos / press mentions before
// launch. Intentionally renders as clearly-marked placeholders, never as
// fake social proof.
export function IndexSocialProof() {
  const { lang } = useI18n();
  const isHe = lang === 'he';

  return (
    <section className='border-y border-[#E8E8EC] bg-[#FBFBFC] py-10 px-6'>
      <div className='max-w-5xl mx-auto'>
        <Reveal>
          <p className='text-center font-body text-xs tracking-[0.18em] uppercase text-[#5C5C66] mb-6'>
            {isHe ? 'צלמים מכל הארץ מעבירים גלריות עם Light Studio' : 'Photographers across Israel deliver with Light Studio'}
          </p>
          <ul className='flex flex-wrap items-center justify-center gap-x-10 gap-y-4'>
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i}
                className='flex h-10 w-32 items-center justify-center rounded-md border border-dashed border-[#D8D8DE] font-body text-xs text-[#A0A0AA]'>
                {isHe ? `[לוגו ${i}]` : `[Logo ${i}]`}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
