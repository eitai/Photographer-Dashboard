import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { SectionHeading } from './photographerHomeComponents';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { PublicSettings, FaqItem } from './photographerHomeTypes';

const homeContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email').max(255),
  phone: z.string().max(20).optional(),
  session_type: z.string().min(1, 'Please select a session type'),
  message: z.string().max(1000).optional(),
});

type HomeContactFormValues = z.infer<typeof homeContactSchema>;

interface HomeSectionContactProps {
  settings: PublicSettings | undefined;
  username: string;
  activeFaq: FaqItem[];
}

export const HomeSectionContact = ({ settings, username, activeFaq }: HomeSectionContactProps) => {
  const { t, lang } = useI18n();
  const isHe = lang === 'he';
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const sessionTypes = [
    t('contact.session.family'),
    t('contact.session.maternity'),
    t('contact.session.newborn'),
    t('contact.session.branding'),
    t('contact.session.landscape'),
  ];

  const {
    register: registerContact,
    handleSubmit: handleContactSubmit,
    formState: { errors: contactErrors, isSubmitting: contactSubmitting },
  } = useForm<HomeContactFormValues>({
    resolver: zodResolver(homeContactSchema),
  });

  const onContactSubmit = async (data: HomeContactFormValues) => {
    try {
      await api.post(`/p/${username}/contact`, {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        sessionType: data.session_type,
        message: data.message || null,
      });
      setContactSubmitted(true);
    } catch {
      toast.error(t('contact.error'));
    }
  };

  return (
    <>
      {activeFaq.length > 0 && (
        <section className='py-20 px-6 bg-[#F8F8F8]'>
          <div className='max-w-3xl mx-auto'>
            <SectionHeading title={isHe ? 'שאלות נפוצות' : 'FAQ'} />
            <Accordion type='single' collapsible className='mt-12 divide-y divide-black/10 border-t border-black/10'>
              {activeFaq.map((item, i) => (
                <AccordionItem key={item.id} value={`faq-${item.id}`} className='border-b-0'>
                  <AccordionTrigger className='text-[#111] font-sans font-medium py-6 text-start hover:no-underline hover:text-black [&>svg]:text-black [&>svg]:shrink-0'>
                    <span className='flex items-center gap-4'>
                      <span className='text-black/25 font-serif text-sm tabular-nums w-6'>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {item.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className='text-[#666] text-base leading-relaxed pb-6 font-sans ps-10'>
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {settings?.contactSectionEnabled !== false && (
        <section id='contact' className='py-20 px-6 bg-white'>
          <div className='max-w-5xl mx-auto grid lg:grid-cols-2 gap-16 items-start'>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <SectionHeading
                title={settings?.contactSectionHeading || t('contact.title')}
                align='start'
              />
              <p className='text-[#666] mt-4 font-sans'>
                {settings?.contactSectionSubheading || t('contact.subtitle')}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              {contactSubmitted ? (
                <div className='py-12 text-center'>
                  <span className='text-5xl font-serif text-black block mb-4'>✓</span>
                  <p className='text-xl font-serif text-black'>{t('contact.success')}</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit(onContactSubmit)} className='space-y-8'>
                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.name')}
                    </label>
                    <input
                      type='text'
                      {...registerContact('name')}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors placeholder-black/20'
                    />
                    {contactErrors.name && (
                      <p className='text-xs text-rose-500 mt-1 font-sans'>{contactErrors.name.message}</p>
                    )}
                  </div>

                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.phone')}
                    </label>
                    <input
                      type='tel'
                      {...registerContact('phone')}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors placeholder-black/20'
                    />
                  </div>

                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.email')}
                    </label>
                    <input
                      type='email'
                      {...registerContact('email')}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors placeholder-black/20'
                    />
                    {contactErrors.email && (
                      <p className='text-xs text-rose-500 mt-1 font-sans'>{contactErrors.email.message}</p>
                    )}
                  </div>

                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.session')}
                    </label>
                    <select
                      {...registerContact('session_type')}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors'
                    >
                      <option value=''>—</option>
                      {sessionTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {contactErrors.session_type && (
                      <p className='text-xs text-rose-500 mt-1 font-sans'>{contactErrors.session_type.message}</p>
                    )}
                  </div>

                  <div className='group'>
                    <label className='block text-xs uppercase tracking-wider text-black/50 mb-2 font-sans'>
                      {t('contact.message')}
                    </label>
                    <textarea
                      {...registerContact('message')}
                      rows={4}
                      className='w-full bg-transparent border-0 border-b border-black/20 py-3 text-[#111] font-sans focus:outline-none focus:border-black transition-colors placeholder-black/20 resize-none'
                    />
                  </div>

                  <button
                    type='submit'
                    disabled={contactSubmitting}
                    className='w-full py-4 bg-black text-white text-sm font-sans font-medium hover:bg-black/80 transition-colors disabled:opacity-50'
                  >
                    {contactSubmitting ? t('contact.submitting') : t('contact.send')}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </section>
      )}
    </>
  );
};
