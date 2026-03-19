import { useState } from 'react';
import { usePhotographer } from './PhotographerLayout';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email').max(255),
  phone: z.string().max(20).optional(),
  session_type: z.string().min(1, 'Please select a session type'),
  message: z.string().max(1000).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export const PhotographerContact = () => {
  const { t } = useI18n();
  const { username } = usePhotographer();
  const [submitted, setSubmitted] = useState(false);

  const sessionTypes = [
    t('contact.session.family'),
    t('contact.session.maternity'),
    t('contact.session.newborn'),
    t('contact.session.branding'),
    t('contact.session.landscape'),
  ];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormValues) => {
    try {
      await api.post(`/p/${username}/contact`, {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        sessionType: data.session_type,
        message: data.message || null,
      });
      setSubmitted(true);
    } catch {
      toast.error(t('contact.error'));
    }
  };

  if (submitted) {
    return (
      <main className='pt-16'>
        <section className='section-spacing'>
          <div className='container-narrow text-center'>
            <FadeIn>
              <div className='max-w-md mx-auto py-20'>
                <p className=' text-2xl text-foreground mb-2'>{t('contact.success')}</p>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className='pt-16'>
      <section className='section-spacing'>
        <div className='container-narrow'>
          <FadeIn>
            <div className='text-center mb-12'>
              <h1 className=' text-4xl md:text-5xl text-foreground mb-4'>{t('contact.title')}</h1>
              <p className='text-muted-foreground'>{t('contact.subtitle')}</p>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <form onSubmit={handleSubmit(onSubmit)} className='max-w-lg mx-auto space-y-5'>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.name')}</label>
                <input
                  type='text'
                  {...register('name')}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
                />
                {errors.name && <p className='text-xs text-rose-500 mt-1'>{errors.name.message}</p>}
              </div>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.phone')}</label>
                <input
                  type='tel'
                  {...register('phone')}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
                />
              </div>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.email')}</label>
                <input
                  type='email'
                  {...register('email')}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
                />
                {errors.email && <p className='text-xs text-rose-500 mt-1'>{errors.email.message}</p>}
              </div>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.session')}</label>
                <select
                  {...register('session_type')}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
                >
                  <option value=''>—</option>
                  {sessionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.session_type && <p className='text-xs text-rose-500 mt-1'>{errors.session_type.message}</p>}
              </div>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.message')}</label>
                <textarea
                  {...register('message')}
                  rows={4}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow resize-none'
                />
              </div>
              <button
                type='submit'
                disabled={isSubmitting}
                className='w-full px-8 py-3 rounded-lg bg-primary text-primary-foreground font-sans text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50'
              >
                {isSubmitting ? t('contact.submitting') : t('contact.send')}
              </button>
            </form>
          </FadeIn>
        </div>
      </section>
    </main>
  );
};
