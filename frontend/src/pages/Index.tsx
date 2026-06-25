import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useI18n } from '../lib/i18n';
import { initAnalytics } from '../lib/analytics';
import { SIGNUP_ROUTE } from './index/landingData';
import { IndexNavHeader } from './index/IndexNavHeader';
import { IndexHeroSection } from './index/IndexHeroSection';
import { IndexSocialProof } from './index/IndexSocialProof';
import { IndexHowItWorksSection } from './index/IndexHowItWorksSection';
import { IndexFeaturesSection } from './index/IndexFeaturesSection';
import { IndexMobileApps } from './index/IndexMobileApps';
import { IndexComparisonSection } from './index/IndexComparisonSection';
import { IndexPricingTeaser } from './index/IndexPricingTeaser';
import { IndexFaqSection } from './index/IndexFaqSection';
import { IndexFinalCta } from './index/IndexFinalCta';

export const Index = () => {
  const { lang, dir } = useI18n();
  const isHe = lang === 'he';
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const navigate = useNavigate();

  function openRegister() {
    navigate(SIGNUP_ROUTE);
  }

  useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    initAnalytics();
  }, []);

  const NAV_LINKS = [
    { label: isHe ? 'יכולות' : 'Features', href: '#features' },
    { label: isHe ? 'איך זה עובד' : 'How it works', href: '#how-it-works' },
    { label: isHe ? 'אפליקציות' : 'Apps', href: '#apps' },
    { label: isHe ? 'תמחור' : 'Pricing', href: '#pricing' },
  ];

  const title = isHe
    ? 'Light Studio | גלריות, לקוחות וחנות הדפסות לצלמים — במקום אחד'
    : 'Light Studio | Galleries, clients & a print store for photographers';
  const description = isHe
    ? 'מעלים גלריה, הלקוח בוחר תמונות מהנייד בלי להירשם, ואתם עורכים, מוסרים ומוכרים הדפסות. בעברית מלאה, עם חיוב בשקלים.'
    : 'Upload a gallery, your client picks photos on their phone with no signup, and you edit, deliver and sell prints. Fully bilingual, billed in shekels.';

  return (
    <div dir={dir} className='min-h-screen bg-white font-body text-[#111111] antialiased overflow-x-hidden'>
      <Helmet htmlAttributes={{ lang, dir }}>
        <title>{title}</title>
        <meta name='description' content={description} />
        <meta property='og:title' content={title} />
        <meta property='og:description' content={description} />
        <meta property='og:type' content='website' />
        <meta property='og:locale' content={isHe ? 'he_IL' : 'en_US'} />
      </Helmet>

      <IndexNavHeader
        navScrolled={navScrolled}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        openRegister={openRegister}
        NAV_LINKS={NAV_LINKS}
      />

      <main>
        <IndexHeroSection openRegister={openRegister} />
        <IndexSocialProof />
        <IndexHowItWorksSection openRegister={openRegister} />
        <IndexFeaturesSection />
        <IndexMobileApps />
        <IndexComparisonSection />
        <IndexPricingTeaser />
        <IndexFaqSection openFaq={openFaq} setOpenFaq={setOpenFaq} />
      </main>

      <IndexFinalCta openRegister={openRegister} NAV_LINKS={NAV_LINKS} />
    </div>
  );
};
