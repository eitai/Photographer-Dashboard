import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { SectionHeading, SocialLinks } from './photographerHomeComponents';
import type { PublicSettings } from './photographerHomeTypes';

interface Photographer {
  name: string;
}

interface HomeSectionAboutProps {
  settings: PublicSettings | undefined;
  photographer: Photographer;
  profileSrc: string;
  bio: string;
}

export const HomeSectionAbout = ({ settings, photographer, profileSrc, bio }: HomeSectionAboutProps) => {
  const { t } = useI18n();

  return (
    <section className='py-20 px-6 bg-[#F8F8F8]'>
      <div className='max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center'>
        <FadeIn>
          <div className='relative aspect-[3/4] overflow-hidden shadow-2xl'>
            <img src={profileSrc} alt={photographer.name} className='w-full h-full object-cover' />
            <div className='absolute -bottom-4 -end-4 w-24 h-24 border-b-2 border-e-2 border-black' />
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div>
            <SectionHeading title={settings?.aboutSectionTitle || t('about.title')} align='start' />
            <span className='text-6xl font-serif text-black/10 leading-none block mb-2' aria-hidden='true'>&ldquo;</span>
            <p className='text-[#444] leading-relaxed font-sans whitespace-pre-line'>{bio}</p>
            {settings && (settings.phone || settings.instagramHandle || settings.facebookUrl || settings.tiktokUrl) && (
              <div className='flex items-center gap-1 mt-6'>
                <SocialLinks settings={settings} />
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
};
