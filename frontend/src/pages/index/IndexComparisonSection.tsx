import React from 'react';
import { useI18n } from '../../lib/i18n';
import { Reveal, SectionLabel, SectionHeading } from './landingComponents';

// "Why us" vs the dollar-priced incumbents. Confident, factual — only claims
// the product actually delivers.
export function IndexComparisonSection() {
  const { lang } = useI18n();
  const isHe = lang === 'he';

  const rows: { label: string; us: string; them: string }[] = isHe
    ? [
        { label: 'עברית ו-RTL', us: 'מלא — הממשק, הגלריות והאימיילים', them: 'אנגלית בלבד' },
        { label: 'מחיר וחיוב', us: 'בשקלים, דרך PayPlus', them: 'בדולרים, בכרטיס בינלאומי' },
        { label: 'תמיכה', us: 'מקומית, בעברית', them: 'באנגלית, באזור זמן אחר' },
        { label: 'עמוד נחיתה אישי', us: 'כלול — 11 ערכות עיצוב', them: 'דורש אתר נפרד' },
        { label: 'בחירת תמונות ללקוח', us: 'בלי הרשמה, עם הערות ותמונת נושא', them: 'בדרך כלל דורש אימייל' },
        { label: 'SMS ללקוח', us: 'נשלח אוטומטית עם הקישור', them: 'לא קיים' },
      ]
    : [
        { label: 'Hebrew & RTL', us: 'Full — UI, galleries and emails', them: 'English only' },
        { label: 'Pricing & billing', us: 'In ₪, via PayPlus', them: 'In USD, international card' },
        { label: 'Support', us: 'Local, in Hebrew', them: 'English, another timezone' },
        { label: 'Personal landing page', us: 'Included — 11 themes', them: 'Requires a separate site' },
        { label: 'Client photo selection', us: 'No signup, with comments & hero pick', them: 'Usually requires an email' },
        { label: 'SMS to clients', us: 'Sent automatically with the link', them: 'Not available' },
      ];

  return (
    <section className='bg-white py-24 px-6'>
      <div className='max-w-4xl mx-auto'>
        <Reveal className='text-center mb-12'>
          <SectionLabel>{isHe ? 'למה Light Studio' : 'Why Light Studio'}</SectionLabel>
          <SectionHeading className='mb-4'>
            {isHe ? 'נבנה לצלמים בישראל. לא תורגם בשבילם.' : 'Built for Israeli photographers. Not translated for them.'}
          </SectionHeading>
          <p className='font-body text-[#5C5C66] max-w-xl mx-auto'>
            {isHe
              ? 'פלטפורמות כמו Pixieset נהדרות — באנגלית ובדולרים. אנחנו מתחילים מהעברית.'
              : 'Platforms like Pixieset are great — in English and in dollars. We start from Hebrew.'}
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className='overflow-x-auto rounded-2xl border border-[#E8E8EC]'>
            <table className='w-full min-w-[520px] border-collapse text-start'>
              <caption className='sr-only'>
                {isHe ? 'השוואה בין Light Studio לפלטפורמות בינלאומיות' : 'Light Studio vs. international platforms'}
              </caption>
              <thead>
                <tr className='border-b border-[#E8E8EC] bg-[#FBFBFC]'>
                  <th scope='col' className='px-5 py-4 text-start font-body text-xs font-semibold uppercase tracking-wider text-[#5C5C66]'></th>
                  <th scope='col' className='px-5 py-4 text-start font-display text-base text-[#111111]'>Light Studio</th>
                  <th scope='col' className='px-5 py-4 text-start font-body text-sm text-[#5C5C66]'>
                    {isHe ? 'פלטפורמות בינלאומיות' : 'International platforms'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className='border-b border-[#E8E8EC] last:border-b-0'>
                    <th scope='row' className='px-5 py-4 text-start font-body text-sm font-medium text-[#111111] whitespace-nowrap'>
                      {row.label}
                    </th>
                    <td className='px-5 py-4 font-body text-sm text-[#111111]'>
                      <span className='me-2 inline-block text-[#F5A623]' aria-hidden='true'>✓</span>{row.us}
                    </td>
                    <td className='px-5 py-4 font-body text-sm text-[#5C5C66]'>{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
