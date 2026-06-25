import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/lib/i18n';
import api, { getImageUrl, API_BASE } from '@/lib/api';
import { toast } from 'sonner';
import { useSettings, queryKeys } from '@/hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';

import { SettingsIdentityTab } from './settings/SettingsIdentityTab';
import { SettingsHeroTab } from './settings/SettingsHeroTab';
import { SettingsAboutTab } from './settings/SettingsAboutTab';
import { SettingsSectionsTab } from './settings/SettingsSectionsTab';
import { SettingsSystemTab } from './settings/SettingsSystemTab';
import { SettingsSecurityTab } from './settings/SettingsSecurityTab';

import type { HeroOverlayOpacity, ServiceItem, TestimonialItem, PackageItem, StatItem, PromiseItem, FaqItem } from './settings/settingsComponents';

type SettingsTab = 'identity' | 'hero' | 'about' | 'sections' | 'system' | 'security';

export const AdminSettings = () => {
  const { admin } = useAuth();
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const setTheme = useAuthStore((s) => s.setTheme);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: settingsData } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'security') return 'security';
    return 'identity';
  });

  // ── Hero tab state ──────────────────────────────────────────────────────────
  const [hero, setHero] = useState({
    heroSubtitle: '',
    heroOverlayOpacity: 'medium' as HeroOverlayOpacity,
    heroCtaPrimaryLabel: '',
    heroCtaSecondaryLabel: '',
  });
  const [heroTagline, setHeroTagline] = useState('');
  const [savingHero, setSavingHero] = useState(false);
  const [heroPreview, setHeroPreview] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const [finalCta, setFinalCta] = useState({ heading: '', subtext: '', buttonLabel: '' });
  const [savingFinalCta, setSavingFinalCta] = useState(false);

  // ── Logo state ──────────────────────────────────────────────────────────────
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── About tab state ─────────────────────────────────────────────────────────
  const [about, setAbout] = useState({
    aboutSectionTitle: '',
    bio: '',
    phone: '',
    contactEmail: '',
    instagramHandle: '',
    facebookUrl: '',
    tiktokUrl: '',
  });
  const [savingAbout, setSavingAbout] = useState(false);
  const [profilePreview, setProfilePreview] = useState('');
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);

  // ── Sections tab state ──────────────────────────────────────────────────────
  const [servicesEnabled, setServicesEnabled] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [testimonialsEnabled, setTestimonialsEnabled] = useState(false);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);

  const [packagesEnabled, setPackagesEnabled] = useState(false);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [packagesDisclaimer, setPackagesDisclaimer] = useState('');

  const [videoEnabled, setVideoEnabled] = useState(false);
  const [video, setVideo] = useState({ url: '', heading: '', subheading: '' });

  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [cta, setCta] = useState({ heading: '', subtext: '', buttonLabel: '' });
  const [ctaBannerImagePreview, setCtaBannerImagePreview] = useState('');

  const [contactSectionEnabled, setContactSectionEnabled] = useState(true);
  const [contactSection, setContactSection] = useState({ heading: '', subheading: '' });

  const [igFeedEnabled, setIgFeedEnabled] = useState(false);
  const [igFeedImages, setIgFeedImages] = useState<string[]>([]);

  const [statsEnabled, setStatsEnabled] = useState(true);
  const [stats, setStats] = useState<StatItem[]>([]);

  const [promisesEnabled, setPromisesEnabled] = useState(true);
  const [promises, setPromises] = useState<PromiseItem[]>([]);

  const [faqEnabled, setFaqEnabled] = useState(true);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);

  // ── Security tab state ──────────────────────────────────────────────────────
  const [disconnectingSSO, setDisconnectingSSO] = useState(false);

  // ── System tab state ────────────────────────────────────────────────────────
  const [systemTheme, setSystemTheme] = useState('soft');
  const [savingTheme, setSavingTheme] = useState(false);
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [autoSendSms, setAutoSendSms] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // ── Populate from settings cache ────────────────────────────────────────────
  useEffect(() => {
    if (!settingsData) return;
    const s = settingsData;

    setSystemTheme(s.theme || 'soft');

    setHero({
      heroSubtitle: s.heroSubtitle || '',
      heroOverlayOpacity: (s.heroOverlayOpacity as HeroOverlayOpacity) || 'medium',
      heroCtaPrimaryLabel: s.heroCtaPrimaryLabel || '',
      heroCtaSecondaryLabel: s.heroCtaSecondaryLabel || '',
    });
    setTheme(s.theme || 'bw');

    setAbout({
      aboutSectionTitle: s.aboutSectionTitle || '',
      bio: s.bio || '',
      phone: s.phone || '',
      contactEmail: s.contactEmail || '',
      instagramHandle: s.instagramHandle || '',
      facebookUrl: s.facebookUrl || '',
      tiktokUrl: s.tiktokUrl || '',
    });

    if (s.heroImagePath) setHeroPreview(getImageUrl(s.heroImagePath));
    if (s.profileImagePath) setProfilePreview(getImageUrl(s.profileImagePath));
    if (s.logoImagePath) setLogoPreview(getImageUrl(s.logoImagePath));
    else setLogoPreview('');

    setServicesEnabled(s.servicesEnabled ?? false);
    setServices(s.services ?? []);
    setTestimonialsEnabled(s.testimonialsEnabled ?? false);
    setTestimonials(s.testimonials ?? []);
    setPackagesEnabled(s.packagesEnabled ?? false);
    setPackages(s.packages ?? []);
    setPackagesDisclaimer(s.packagesDisclaimer || '');
    setVideoEnabled(s.videoSectionEnabled ?? false);
    setVideo({ url: s.videoUrl || '', heading: s.videoSectionHeading || '', subheading: s.videoSectionSubheading || '' });
    setCtaEnabled(s.ctaBannerEnabled ?? false);
    setCta({ heading: s.ctaBannerHeading || '', subtext: s.ctaBannerSubtext || '', buttonLabel: s.ctaBannerButtonLabel || '' });
    if (s.ctaBannerImagePath) setCtaBannerImagePreview(getImageUrl(s.ctaBannerImagePath));
    else setCtaBannerImagePreview('');
    setContactSectionEnabled(s.contactSectionEnabled ?? true);
    setContactSection({ heading: s.contactSectionHeading || '', subheading: s.contactSectionSubheading || '' });
    setIgFeedEnabled(s.instagramFeedEnabled ?? false);
    setIgFeedImages(s.instagramFeedImages ?? []);
    setAutoSendEmail(s.autoSendGalleryEmail ?? true);
    setAutoSendSms(s.autoSendGallerySms ?? false);
    setHeroTagline(s.heroTagline || '');
    setFinalCta({ heading: s.finalCtaHeading || '', subtext: s.finalCtaSubtext || '', buttonLabel: s.finalCtaButtonLabel || '' });
    setStatsEnabled(s.statsEnabled ?? true);
    setStats(s.stats ?? []);
    setPromisesEnabled(s.promisesEnabled ?? true);
    setPromises(s.promises ?? []);
    setFaqEnabled(s.faqEnabled ?? true);
    setFaqItems(s.faqItems ?? []);
  }, [settingsData]);

  // ── SSO linked toast on redirect ─────────────────────────────────────────
  useEffect(() => {
    const sso = searchParams.get('sso');
    if (sso === 'linked') {
      toast.success(t('admin.settings.sso.linked_success'));
      api.get('/auth/me').then((res) => setAdmin(res.data.admin)).catch(() => {});
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('sso');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, t, setAdmin]);

  // ── Handlers: Security ──────────────────────────────────────────────────────
  const handleDisconnectSSO = async () => {
    setDisconnectingSSO(true);
    try {
      const res = await api.delete('/auth/google/link');
      if (res.status === 200 && admin) {
        setAdmin({ ...admin, ssoEnabled: false, googleEmail: null });
        toast.success(t('admin.settings.sso.unlink_success'));
      }
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setDisconnectingSSO(false);
    }
  };

  const handleConnectGoogle = () => {
    window.location.href = `${API_BASE}/api/auth/google/link`;
  };

  // ── Handlers: Logo ──────────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/settings/logo-image', form, { headers: { 'Content-Type': undefined } });
      setLogoPreview(getImageUrl(res.data.logoImagePath));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.logo_upload_failed'));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    setRemovingLogo(true);
    try {
      await api.delete('/settings/logo-image');
      setLogoPreview('');
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setRemovingLogo(false);
    }
  };

  // ── Handlers: Hero ──────────────────────────────────────────────────────────
  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/settings/hero-image', form, { headers: { 'Content-Type': undefined } });
      setHeroPreview(getImageUrl(res.data.heroImagePath));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.hero_upload_failed'));
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = '';
    }
  };

  const handleSaveHero = async () => {
    setSavingHero(true);
    try {
      await api.put('/settings/landing', {
        heroTagline,
        heroSubtitle: hero.heroSubtitle,
        heroOverlayOpacity: hero.heroOverlayOpacity,
        heroCtaPrimaryLabel: hero.heroCtaPrimaryLabel,
        heroCtaSecondaryLabel: hero.heroCtaSecondaryLabel,
      });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingHero(false);
    }
  };

  const handleSaveFinalCta = async () => {
    setSavingFinalCta(true);
    try {
      await api.put('/settings/landing', { finalCtaHeading: finalCta.heading, finalCtaSubtext: finalCta.subtext, finalCtaButtonLabel: finalCta.buttonLabel });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch { toast.error(t('admin.settings.landing_failed')); }
    finally { setSavingFinalCta(false); }
  };

  // ── Handlers: System / Theme ───────────────────────────────────────────────
  const handleSaveTheme = async () => {
    setSavingTheme(true);
    try {
      await api.put('/settings/landing', { theme: systemTheme });
      setTheme(systemTheme);
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingTheme(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      await api.put('/settings/notifications', { autoSendGalleryEmail: autoSendEmail, autoSendGallerySms: autoSendSms });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingNotifications(false);
    }
  };

  // ── Handlers: About ─────────────────────────────────────────────────────────
  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProfile(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/settings/profile-image', form, { headers: { 'Content-Type': undefined } });
      setProfilePreview(getImageUrl(res.data.profileImagePath));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.profile_upload_failed'));
    } finally {
      setUploadingProfile(false);
      if (profileInputRef.current) profileInputRef.current.value = '';
    }
  };

  const handleSaveAbout = async () => {
    setSavingAbout(true);
    try {
      await api.put('/settings/landing', {
        bio: about.bio,
        phone: about.phone,
        contactEmail: about.contactEmail,
        instagramHandle: about.instagramHandle,
        facebookUrl: about.facebookUrl,
        tiktokUrl: about.tiktokUrl,
        aboutSectionTitle: about.aboutSectionTitle,
      });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingAbout(false);
    }
  };

  // ── Tab bar ─────────────────────────────────────────────────────────────────
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'identity', label: t('admin.settings.tab.identity') },
    { id: 'hero', label: t('admin.settings.tab.hero') },
    { id: 'about', label: t('admin.settings.tab.about') },
    { id: 'sections', label: t('admin.settings.tab.sections') },
    { id: 'system', label: t('admin.settings.tab.system') },
    { id: 'security', label: t('admin.settings.tab.security') },
  ];

  return (
    <AdminLayout title={t('admin.settings.title')}>
      <div className='flex gap-1 border-b border-beige mb-6 overflow-x-auto pb-px'>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type='button'
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blush ${
              activeTab === id
                ? 'text-charcoal border-b-2 border-blush'
                : 'text-warm-gray hover:text-charcoal hover:bg-ivory'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'identity' && (
        <SettingsIdentityTab
          admin={admin}
          logoPreview={logoPreview}
          uploadingLogo={uploadingLogo}
          removingLogo={removingLogo}
          logoInputRef={logoInputRef}
          onLogoUpload={handleLogoUpload}
          onLogoRemove={handleLogoRemove}
          onProfileSaved={setAdmin}
        />
      )}

      {activeTab === 'hero' && (
        <SettingsHeroTab
          hero={hero}
          setHero={setHero}
          heroTagline={heroTagline}
          setHeroTagline={setHeroTagline}
          heroPreview={heroPreview}
          uploadingHero={uploadingHero}
          heroInputRef={heroInputRef}
          onHeroUpload={handleHeroUpload}
          savingHero={savingHero}
          onSaveHero={handleSaveHero}
          finalCta={finalCta}
          setFinalCta={setFinalCta}
          savingFinalCta={savingFinalCta}
          onSaveFinalCta={handleSaveFinalCta}
        />
      )}

      {activeTab === 'about' && (
        <SettingsAboutTab
          about={about}
          setAbout={setAbout}
          profilePreview={profilePreview}
          uploadingProfile={uploadingProfile}
          profileInputRef={profileInputRef}
          onProfileUpload={handleProfileUpload}
          savingAbout={savingAbout}
          onSaveAbout={handleSaveAbout}
        />
      )}

      {activeTab === 'sections' && (
        <SettingsSectionsTab
          servicesEnabled={servicesEnabled}
          setServicesEnabled={setServicesEnabled}
          services={services}
          setServices={setServices}
          testimonialsEnabled={testimonialsEnabled}
          setTestimonialsEnabled={setTestimonialsEnabled}
          testimonials={testimonials}
          setTestimonials={setTestimonials}
          packagesEnabled={packagesEnabled}
          setPackagesEnabled={setPackagesEnabled}
          packages={packages}
          setPackages={setPackages}
          packagesDisclaimer={packagesDisclaimer}
          setPackagesDisclaimer={setPackagesDisclaimer}
          videoEnabled={videoEnabled}
          setVideoEnabled={setVideoEnabled}
          video={video}
          setVideo={setVideo}
          ctaEnabled={ctaEnabled}
          setCtaEnabled={setCtaEnabled}
          cta={cta}
          setCta={setCta}
          ctaBannerImagePreview={ctaBannerImagePreview}
          setCtaBannerImagePreview={setCtaBannerImagePreview}
          contactSectionEnabled={contactSectionEnabled}
          setContactSectionEnabled={setContactSectionEnabled}
          contactSection={contactSection}
          setContactSection={setContactSection}
          igFeedEnabled={igFeedEnabled}
          setIgFeedEnabled={setIgFeedEnabled}
          igFeedImages={igFeedImages}
          setIgFeedImages={setIgFeedImages}
          statsEnabled={statsEnabled}
          setStatsEnabled={setStatsEnabled}
          stats={stats}
          setStats={setStats}
          promisesEnabled={promisesEnabled}
          setPromisesEnabled={setPromisesEnabled}
          promises={promises}
          setPromises={setPromises}
          faqEnabled={faqEnabled}
          setFaqEnabled={setFaqEnabled}
          faqItems={faqItems}
          setFaqItems={setFaqItems}
        />
      )}

      {activeTab === 'system' && (
        <SettingsSystemTab
          systemTheme={systemTheme}
          setSystemTheme={setSystemTheme}
          savingTheme={savingTheme}
          onSaveTheme={handleSaveTheme}
          autoSendEmail={autoSendEmail}
          setAutoSendEmail={setAutoSendEmail}
          autoSendSms={autoSendSms}
          setAutoSendSms={setAutoSendSms}
          savingNotifications={savingNotifications}
          onSaveNotifications={handleSaveNotifications}
        />
      )}

      {activeTab === 'security' && (
        <SettingsSecurityTab
          admin={admin}
          disconnectingSSO={disconnectingSSO}
          onDisconnectSSO={handleDisconnectSSO}
          onConnectGoogle={handleConnectGoogle}
        />
      )}
    </AdminLayout>
  );
};
