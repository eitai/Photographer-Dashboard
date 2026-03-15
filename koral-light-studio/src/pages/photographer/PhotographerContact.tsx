import { useState } from 'react';
import { usePhotographer } from './PhotographerLayout';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import api from '@/lib/api';

export const PhotographerContact = () => {
  const { t } = useI18n();
  const { username } = usePhotographer();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sessionTypes = [
    t('contact.session.family'),
    t('contact.session.maternity'),
    t('contact.session.newborn'),
    t('contact.session.branding'),
    t('contact.session.landscape'),
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim() || null;
    const sessionType = (formData.get('session_type') as string) || null;
    const message = (formData.get('message') as string)?.trim() || null;

    if (!name || !email) {
      toast.error(t('contact.required_fields'));
      setSubmitting(false);
      return;
    }

    try {
      await api.post(`/p/${username}/contact`, { name, email, phone, sessionType, message });
      setSubmitted(true);
    } catch {
      toast.error(t('contact.error'));
      setSubmitting(false);
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
            <form onSubmit={handleSubmit} className='max-w-lg mx-auto space-y-5'>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.name')}</label>
                <input
                  name='name'
                  type='text'
                  required
                  maxLength={100}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
                />
              </div>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.phone')}</label>
                <input
                  name='phone'
                  type='tel'
                  maxLength={20}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
                />
              </div>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.email')}</label>
                <input
                  name='email'
                  type='email'
                  required
                  maxLength={255}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
                />
              </div>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.session')}</label>
                <select
                  name='session_type'
                  required
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
                >
                  <option value=''>—</option>
                  {sessionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm text-muted-foreground mb-1.5'>{t('contact.message')}</label>
                <textarea
                  name='message'
                  rows={4}
                  maxLength={1000}
                  className='w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow resize-none'
                />
              </div>
              <button
                type='submit'
                disabled={submitting}
                className='w-full px-8 py-3 rounded-lg bg-primary text-primary-foreground font-sans text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50'
              >
                {submitting ? t('contact.submitting') : t('contact.send')}
              </button>
            </form>
          </FadeIn>
        </div>
      </section>
    </main>
  );
};
