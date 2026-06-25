import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { SectionHeading, StarRating } from './photographerHomeComponents';
import type { TestimonialItem } from './photographerHomeTypes';

interface HomeSectionTestimonialsProps {
  testimonials: TestimonialItem[];
  activeTestimonial: number;
  setActiveTestimonial: (i: number) => void;
}

export const HomeSectionTestimonials = ({
  testimonials,
  activeTestimonial,
  setActiveTestimonial,
}: HomeSectionTestimonialsProps) => {
  const { t } = useI18n();

  return (
    <section className='py-20 px-6 bg-[#F8F8F8]'>
      <div className='max-w-4xl mx-auto'>
        <SectionHeading title={t('testimonials.title')} />

        <div className='mt-16 flex items-start gap-8'>
          <span className='text-[100px] md:text-[140px] font-light font-serif leading-none text-black/[0.08] select-none shrink-0 hidden md:block'>
            {String(activeTestimonial + 1).padStart(2, '0')}
          </span>

          <div className='flex-1'>
            <motion.blockquote
              key={activeTestimonial}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className='text-2xl md:text-3xl font-serif text-black leading-relaxed mb-10'
            >
              &ldquo;{testimonials[activeTestimonial].text}&rdquo;
            </motion.blockquote>

            <motion.div
              key={`author-${activeTestimonial}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className='flex items-center gap-4'
            >
              <div className='w-10 h-0.5 bg-black' />
              <div>
                <p className='font-semibold font-sans text-black'>
                  {testimonials[activeTestimonial].clientName}
                </p>
                {testimonials[activeTestimonial].sessionType && (
                  <p className='text-sm text-[#666] font-sans'>
                    {testimonials[activeTestimonial].sessionType}
                  </p>
                )}
              </div>
              {testimonials[activeTestimonial].rating != null && (
                <StarRating rating={testimonials[activeTestimonial].rating!} />
              )}
            </motion.div>

            <div className='flex items-center gap-8 mt-12 pt-8 border-t border-black/10'>
              <div className='flex gap-4 items-center'>
                {testimonials.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveTestimonial(idx)}
                    aria-label={`Testimonial ${idx + 1}`}
                    className={`h-px transition-all duration-300 ${
                      idx === activeTestimonial
                        ? 'w-10 bg-black'
                        : 'w-5 bg-black/20 hover:w-7 hover:bg-black/40'
                    }`}
                  />
                ))}
              </div>
              <span className='text-xs text-[#666] uppercase tracking-wider font-sans'>
                {String(activeTestimonial + 1).padStart(2, '0')} / {String(testimonials.length).padStart(2, '0')}
              </span>
              <div className='ms-auto flex gap-2'>
                <button
                  onClick={() => setActiveTestimonial(Math.max(0, activeTestimonial - 1))}
                  disabled={activeTestimonial === 0}
                  aria-label='Previous testimonial'
                  className='p-2 text-black/40 hover:text-black disabled:opacity-20 transition-colors'
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setActiveTestimonial(Math.min(testimonials.length - 1, activeTestimonial + 1))}
                  disabled={activeTestimonial === testimonials.length - 1}
                  aria-label='Next testimonial'
                  className='p-2 text-black/40 hover:text-black disabled:opacity-20 transition-colors'
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
