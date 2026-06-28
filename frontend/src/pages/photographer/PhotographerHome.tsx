import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { usePhotographer } from './usePhotographer';
import { useI18n } from '@/lib/i18n';
import api, { getImageUrl } from '@/lib/api';
import heroFallback from '@/assets/hero-family.jpg';
import aboutFallback from '@/assets/about-koral.jpg';
import { toEmbedUrl, DEFAULT_STATS, DEFAULT_PROMISES, DEFAULT_FAQ } from './home/photographerHomeTypes';
import type { PublicSettings } from './home/photographerHomeTypes';
import { HomeSectionHero } from './home/HomeSectionHero';
import { HomeSectionAbout } from './home/HomeSectionAbout';
import { HomeSectionServices } from './home/HomeSectionServices';
import { HomeSectionTestimonials } from './home/HomeSectionTestimonials';
import { HomeSectionPackages } from './home/HomeSectionPackages';
import { HomeSectionMedia } from './home/HomeSectionMedia';
import { HomeSectionCtaBlocks } from './home/HomeSectionCtaBlocks';
import { HomeSectionContact } from './home/HomeSectionContact';

export const PhotographerHome = () => {
  const { t, lang } = useI18n();
  const isHe = lang === 'he';
  const { username, photographer } = usePhotographer();
  const [videoActive, setVideoActive] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const { data: settings, isLoading: settingsLoading } = useQuery<PublicSettings>({
    queryKey: ['photographerSettings', username],
    queryFn: () => api.get(`/p/${username}/settings`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: latestPosts } = useQuery<{ _id: string; slug: string; title: string; featuredImagePath?: string; category?: string; publishedAt?: string }[]>({
    queryKey: ['photographerBlog', username],
    queryFn: () => api.get(`/p/${username}/blog`).then((r) => r.data.slice(0, 3)),
    staleTime: 5 * 60 * 1000,
  });

  const heroSrc = settings?.heroImagePath
    ? getImageUrl(settings.heroImagePath)
    : settingsLoading ? null : heroFallback;

  const profileSrc = settings?.profileImagePath ? getImageUrl(settings.profileImagePath) : aboutFallback;

  const [heroImgLoaded, setHeroImgLoaded] = useState(false);
  useEffect(() => { setHeroImgLoaded(false); }, [heroSrc]);

  const bio = settings?.bio || t('about.text');
  const photographerName = photographer?.name || username;
  const canonicalUrl = `${window.location.origin}/${username}`;

  const showServices = !!(settings?.servicesEnabled && settings.services?.length > 0);
  const showTestimonials = !!(settings?.testimonialsEnabled && settings.testimonials?.length > 0);
  const showPackages = !!(settings?.packagesEnabled && settings.packages?.length > 0);
  const showVideo = !!(settings?.videoSectionEnabled && settings.videoUrl);
  const showInstagramFeed = !!(settings?.instagramFeedEnabled && settings.instagramFeedImages?.length > 0);
  const showCtaBanner = !!(settings?.ctaBannerEnabled && settings.ctaBannerHeading);
  const embedUrl = showVideo ? toEmbedUrl(settings!.videoUrl) : null;

  const activeStats = (settings?.statsEnabled !== false)
    ? (settings?.stats?.length ? settings.stats : DEFAULT_STATS(isHe))
    : [];

  const activePromises = (settings?.promisesEnabled !== false)
    ? (settings?.promises?.length ? settings.promises : DEFAULT_PROMISES(isHe))
    : [];

  const activeFaq = (settings?.faqEnabled !== false)
    ? (settings?.faqItems?.length ? settings.faqItems : DEFAULT_FAQ(isHe))
    : [];

  return (
    <main className='bg-white pt-16'>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>

      <Helmet>
        <title>{photographerName} | Photography</title>
        <meta name='description' content={bio} />
        <meta property='og:title' content={`${photographerName} | Photography`} />
        <meta property='og:description' content={bio} />
        <meta property='og:url' content={canonicalUrl} />
        {settings?.profileImagePath && <meta property='og:image' content={getImageUrl(settings.profileImagePath)} />}
        <link rel='canonical' href={canonicalUrl} />
        <script type='application/ld+json'>
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: photographerName,
            description: bio,
            url: canonicalUrl,
          })}
        </script>
      </Helmet>

      <HomeSectionHero
        settings={settings}
        photographer={photographer}
        username={username}
        heroSrc={heroSrc}
        heroImgLoaded={heroImgLoaded}
        setHeroImgLoaded={setHeroImgLoaded}
        showVideo={showVideo}
        embedUrl={embedUrl}
        videoActive={videoActive}
        setVideoActive={setVideoActive}
      />

      <div className='overflow-hidden bg-black py-3'>
        <div className='flex whitespace-nowrap animate-marquee'>
          {[...Array(3)].map((_, rep) => (
            <span
              key={rep}
              className='flex items-center gap-8 text-xs font-sans text-white/60 uppercase tracking-widest px-8'
            >
              <span className='text-white'>·</span> צילומי חתונה
              <span className='text-white'>·</span> צילומי משפחה
              <span className='text-white'>·</span> בר מצוות
              <span className='text-white'>·</span> צילומי נוף
              <span className='text-white'>·</span> אירועים
              <span className='text-white'>·</span> צילומי תינוקות
              <span className='text-white'>·</span> Wedding Photography
              <span className='text-white'>·</span> Family Portraits
            </span>
          ))}
        </div>
      </div>

      {settings && (
        <HomeSectionServices
          settings={settings}
          username={username}
          showServices={showServices}
          activeStats={activeStats}
          activePromises={activePromises}
        />
      )}

      <HomeSectionAbout
        settings={settings}
        photographer={photographer}
        profileSrc={profileSrc}
        bio={bio}
      />

      {showTestimonials && settings && (
        <HomeSectionTestimonials
          testimonials={settings.testimonials}
          activeTestimonial={activeTestimonial}
          setActiveTestimonial={setActiveTestimonial}
        />
      )}

      {showPackages && settings && (
        <HomeSectionPackages settings={settings} username={username} />
      )}

      <HomeSectionMedia
        settings={settings}
        username={username}
        photographerName={photographerName}
        showInstagramFeed={showInstagramFeed}
        latestPosts={latestPosts}
      />

      {settings && (
        <HomeSectionCtaBlocks
          settings={settings}
          username={username}
          showCtaBanner={showCtaBanner}
        />
      )}

      <HomeSectionContact
        settings={settings}
        username={username}
        activeFaq={activeFaq}
      />
    </main>
  );
};
