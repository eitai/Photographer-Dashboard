import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/lib/i18n';
import api, { getImageUrl, API_BASE } from '@/lib/api';
import { toast } from 'sonner';
import {
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Camera,
  Heart,
  Baby,
  Diamond,
  Building2,
  Mountain,
  Users,
  Star,
  Pencil,
  Check,
  X,
  Aperture,
  Clock,
  Smile,
  Award,
} from 'lucide-react';
import { InputField, TextareaField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { useSettings, useAdminProducts, queryKeys, type AdminProduct } from '@/hooks/useQueries';
import { Modal } from '@/components/ui/Modal';
import { useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HeroOverlayOpacity = 'light' | 'medium' | 'dark';

interface StatItem {
  id: string;
  value: number;
  suffix: string;
  label: string;
}

interface PromiseItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

interface ServiceItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  startingPrice: string;
  sessionTypeValue: string;
}

interface TestimonialItem {
  id: string;
  text: string;
  clientName: string;
  sessionType: string;
  rating: number | null;
}

interface PackageItem {
  id: string;
  name: string;
  price: string;
  inclusions: string[];
  isHighlighted: boolean;
  ctaLabel: string;
}

type SettingsTab = 'identity' | 'hero' | 'about' | 'sections' | 'system' | 'security';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THEMES = ['soft', 'bw'] as const;
const THEME_META: Record<string, { bg: string; primary: string; fg: string }> = {
  soft: { bg: '#faf8f4', primary: '#e7b8b5', fg: '#3c3a38' },
  bw: { bg: '#ffffff', primary: '#000000', fg: '#000000' },
};

const SERVICE_ICONS = [
  { name: 'camera', Icon: Camera },
  { name: 'heart', Icon: Heart },
  { name: 'baby', Icon: Baby },
  { name: 'diamond', Icon: Diamond },
  { name: 'building-2', Icon: Building2 },
  { name: 'mountain', Icon: Mountain },
  { name: 'users', Icon: Users },
  { name: 'star', Icon: Star },
  { name: 'aperture', Icon: Aperture },
  { name: 'clock', Icon: Clock },
  { name: 'smile', Icon: Smile },
  { name: 'award', Icon: Award },
];

const SESSION_TYPE_OPTIONS = ['family', 'maternity', 'newborn', 'branding', 'landscape', 'other'] as const;

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------------------------------------------------------------------------
// ThemePicker
// ---------------------------------------------------------------------------

interface ThemePickerProps {
  value: string;
  onChange: (key: string) => void;
  label: string;
  getLabel: (key: string) => string;
}

const ThemePicker = ({ value, onChange, label, getLabel }: ThemePickerProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = THEME_META[value];

  return (
    <div>
      <label className='block text-xs text-warm-gray mb-2'>{label}</label>
      <div ref={ref} className='relative'>
        <button
          type='button'
          onClick={() => setOpen((o) => !o)}
          className='w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-card border border-beige text-charcoal text-sm hover:border-blush/50 transition-colors'
        >
          <div
            className='w-4 h-4 rounded-full border flex-shrink-0'
            style={{ background: `linear-gradient(135deg, ${current?.bg} 50%, ${current?.primary} 50%)` }}
          />
          <span className='flex-1 text-left'>{getLabel(value)}</span>
          <svg width='12' height='12' viewBox='0 0 12 12' fill='currentColor' className='text-warm-gray'>
            <path d='M2 4l4 4 4-4' stroke='currentColor' strokeWidth='1.5' fill='none' strokeLinecap='round' />
          </svg>
        </button>

        {open && (
          <div className='absolute z-50 mt-1 w-full bg-card border border-beige rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto'>
            {THEMES.map((key) => {
              const m = THEME_META[key];
              const isSelected = value === key;
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-ivory transition-colors ${isSelected ? 'text-charcoal font-medium' : 'text-warm-gray'}`}
                >
                  <div
                    className='w-5 h-5 rounded-full border flex-shrink-0'
                    style={{ background: `linear-gradient(135deg, ${m.bg} 50%, ${m.primary} 50%)` }}
                  />
                  {getLabel(key)}
                  {isSelected && <span className='ms-auto text-blush'>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SectionCard — wrapper for each sub-section in the Sections tab
// ---------------------------------------------------------------------------

interface SectionCardProps {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  enabledLabel: string;
  children: React.ReactNode;
  onSave: () => void;
  saveLabel: string;
  saving: boolean;
}

const SectionCard = ({ title, enabled, onToggle, enabledLabel, children, onSave, saveLabel, saving }: SectionCardProps) => (
  <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
    <div className='flex items-center justify-between gap-4'>
      <h3 className='font-semibold text-charcoal'>{title}</h3>
      <label className='flex items-center gap-2 cursor-pointer select-none'>
        <span className='text-xs text-warm-gray'>{enabledLabel}</span>
        <button
          type='button'
          role='switch'
          aria-checked={enabled}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-blush ${enabled ? 'bg-blush' : 'bg-beige'}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${enabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </label>
    </div>

    {children}

    <div className='pt-2 border-t border-beige'>
      <Button type='button' variant='primary' size='sm' onClick={onSave} disabled={saving}>
        {saving ? '...' : saveLabel}
      </Button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// ServiceIconPicker
// ---------------------------------------------------------------------------

const ServiceIconPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const { t } = useI18n();
  return (
    <div>
      <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.icon')}</label>
      <div className='flex flex-wrap gap-2'>
        {SERVICE_ICONS.map(({ name, Icon }) => (
          <button
            key={name}
            type='button'
            onClick={() => onChange(name)}
            className={`p-2 rounded-lg border transition-colors ${value === name ? 'border-blush bg-blush/10 text-blush' : 'border-beige text-warm-gray hover:border-blush/50'}`}
            title={name}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inline item form helpers
// ---------------------------------------------------------------------------

const fieldClass = 'w-full border border-beige rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:border-blush bg-ivory';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const AdminSettings = () => {
  const { admin } = useAuth();
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const setTheme = useAuthStore((s) => s.setTheme);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: settingsData } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Active tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'security') return 'security';
    return 'identity';
  });

  // ── Identity tab state ──────────────────────────────────────────────────────

  const [profile, setProfile] = useState({ name: admin?.name ?? '', studioName: admin?.studioName ?? '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Product catalog state
  const { data: catalogProducts = [], refetch: refetchCatalog } = useAdminProducts();
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ name: '', type: 'album' as 'album' | 'print', maxPhotos: 20 });
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [deletingCatalogId, setDeletingCatalogId] = useState<string | null>(null);

  // ── Hero tab state ──────────────────────────────────────────────────────────
  const [hero, setHero] = useState({
    heroSubtitle: '',
    heroOverlayOpacity: 'medium' as HeroOverlayOpacity,
    heroCtaPrimaryLabel: '',
    heroCtaSecondaryLabel: '',
  });
  const [savingHero, setSavingHero] = useState(false);
  const [heroPreview, setHeroPreview] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

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

  // Services
  const [servicesEnabled, setServicesEnabled] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [savingServices, setSavingServices] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<Omit<ServiceItem, 'id'>>({
    icon: 'camera', title: '', description: '', startingPrice: '', sessionTypeValue: '',
  });

  // Testimonials
  const [testimonialsEnabled, setTestimonialsEnabled] = useState(false);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [savingTestimonials, setSavingTestimonials] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<Omit<TestimonialItem, 'id'>>({
    text: '', clientName: '', sessionType: '', rating: null,
  });

  // Packages
  const [packagesEnabled, setPackagesEnabled] = useState(false);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [packagesDisclaimer, setPackagesDisclaimer] = useState('');
  const [savingPackages, setSavingPackages] = useState(false);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState<Omit<PackageItem, 'id' | 'inclusions'> & { inclusionsRaw: string }>({
    name: '', price: '', inclusionsRaw: '', isHighlighted: false, ctaLabel: '',
  });

  // Video
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [video, setVideo] = useState({ url: '', heading: '', subheading: '' });
  const [savingVideo, setSavingVideo] = useState(false);

  // CTA Banner
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [cta, setCta] = useState({ heading: '', subtext: '', buttonLabel: '' });
  const [savingCta, setSavingCta] = useState(false);
  const [ctaBannerImagePreview, setCtaBannerImagePreview] = useState('');
  const [uploadingCtaBannerImage, setUploadingCtaBannerImage] = useState(false);
  const [removingCtaBannerImage, setRemovingCtaBannerImage] = useState(false);
  const ctaBannerImageRef = useRef<HTMLInputElement>(null);

  // Contact Section
  const [contactSectionEnabled, setContactSectionEnabled] = useState(true);
  const [contactSection, setContactSection] = useState({ heading: '', subheading: '' });
  const [savingContactSection, setSavingContactSection] = useState(false);

  // Instagram Feed
  const [igFeedEnabled, setIgFeedEnabled] = useState(false);
  const [igFeedImages, setIgFeedImages] = useState<string[]>([]);
  const [savingIgFeed, setSavingIgFeed] = useState(false);
  const [uploadingIgImage, setUploadingIgImage] = useState(false);
  const igFeedInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const [statsEnabled, setStatsEnabled] = useState(true);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [savingStats, setSavingStats] = useState(false);
  const [showStatForm, setShowStatForm] = useState(false);
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [statForm, setStatForm] = useState({ value: 0, suffix: '+', label: '' });

  // Promises
  const [promisesEnabled, setPromisesEnabled] = useState(true);
  const [promises, setPromises] = useState<PromiseItem[]>([]);
  const [savingPromises, setSavingPromises] = useState(false);
  const [showPromiseForm, setShowPromiseForm] = useState(false);
  const [editingPromiseId, setEditingPromiseId] = useState<string | null>(null);
  const [promiseForm, setPromiseForm] = useState({ icon: 'camera', title: '', description: '' });

  // FAQ
  const [faqEnabled, setFaqEnabled] = useState(true);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [savingFaq, setSavingFaq] = useState(false);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqForm, setFaqForm] = useState({ q: '', a: '' });

  // Hero tagline and Final CTA
  const [heroTagline, setHeroTagline] = useState('');
  const [finalCta, setFinalCta] = useState({ heading: '', subtext: '', buttonLabel: '' });
  const [savingFinalCta, setSavingFinalCta] = useState(false);

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
      // Refresh admin in store so the connected Google email appears immediately
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

  // ── Handlers: Identity ──────────────────────────────────────────────────────
  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.patch('/auth/profile', {
        name: profile.name || undefined,
        studioName: profile.studioName || undefined,
      });
      setAdmin(res.data);
      toast.success(t('admin.settings.profile_saved'));
      setProfileMsg('');
    } catch {
      toast.error(t('admin.settings.profile_failed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCatalogCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogForm.name.trim()) return;
    setSavingCatalog(true);
    try {
      await api.post('/admin-products', { name: catalogForm.name.trim(), type: catalogForm.type, maxPhotos: catalogForm.maxPhotos });
      setCatalogForm({ name: '', type: 'album', maxPhotos: 20 });
      setShowCatalogForm(false);
      refetchCatalog();
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleCatalogDelete = async (id: string) => {
    setDeletingCatalogId(id);
    try {
      await api.delete(`/admin-products/${id}`);
      refetchCatalog();
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setDeletingCatalogId(null);
    }
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
        heroTagline: heroTagline,
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

  // ── Handlers: Services ──────────────────────────────────────────────────────
  const resetServiceForm = () => {
    setServiceForm({ icon: 'camera', title: '', description: '', startingPrice: '', sessionTypeValue: '' });
    setEditingServiceId(null);
    setShowServiceForm(false);
  };

  const handleServiceSubmit = () => {
    if (!serviceForm.title.trim()) return;
    if (editingServiceId) {
      setServices((prev) => prev.map((s) => s.id === editingServiceId ? { ...serviceForm, id: editingServiceId } : s));
    } else {
      if (services.length >= 8) { toast.error('Maximum 8 services'); return; }
      setServices((prev) => [...prev, { ...serviceForm, id: newId() }]);
    }
    resetServiceForm();
  };

  const handleServiceEdit = (item: ServiceItem) => {
    setServiceForm({ icon: item.icon, title: item.title, description: item.description, startingPrice: item.startingPrice, sessionTypeValue: item.sessionTypeValue });
    setEditingServiceId(item.id);
    setShowServiceForm(true);
  };

  const handleServiceDelete = (id: string) => setServices((prev) => prev.filter((s) => s.id !== id));

  const moveService = (index: number, dir: -1 | 1) => {
    const next = [...services];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setServices(next);
  };

  const handleSaveServices = async () => {
    setSavingServices(true);
    try {
      await api.put('/settings/services', { enabled: servicesEnabled, items: services });
      toast.success(t('admin.settings.sections.save_services'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingServices(false);
    }
  };

  // ── Handlers: Testimonials ──────────────────────────────────────────────────
  const resetTestimonialForm = () => {
    setTestimonialForm({ text: '', clientName: '', sessionType: '', rating: null });
    setEditingTestimonialId(null);
    setShowTestimonialForm(false);
  };

  const handleTestimonialSubmit = () => {
    if (!testimonialForm.text.trim() || !testimonialForm.clientName.trim()) return;
    if (editingTestimonialId) {
      setTestimonials((prev) => prev.map((t) => t.id === editingTestimonialId ? { ...testimonialForm, id: editingTestimonialId } : t));
    } else {
      if (testimonials.length >= 12) { toast.error('Maximum 12 testimonials'); return; }
      setTestimonials((prev) => [...prev, { ...testimonialForm, id: newId() }]);
    }
    resetTestimonialForm();
  };

  const handleTestimonialEdit = (item: TestimonialItem) => {
    setTestimonialForm({ text: item.text, clientName: item.clientName, sessionType: item.sessionType, rating: item.rating });
    setEditingTestimonialId(item.id);
    setShowTestimonialForm(true);
  };

  const handleTestimonialDelete = (id: string) => setTestimonials((prev) => prev.filter((t) => t.id !== id));

  const moveTestimonial = (index: number, dir: -1 | 1) => {
    const next = [...testimonials];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setTestimonials(next);
  };

  const handleSaveTestimonials = async () => {
    setSavingTestimonials(true);
    try {
      await api.put('/settings/testimonials', { enabled: testimonialsEnabled, items: testimonials });
      toast.success(t('admin.settings.sections.save_testimonials'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingTestimonials(false);
    }
  };

  // ── Handlers: Packages ──────────────────────────────────────────────────────
  const resetPackageForm = () => {
    setPackageForm({ name: '', price: '', inclusionsRaw: '', isHighlighted: false, ctaLabel: '' });
    setEditingPackageId(null);
    setShowPackageForm(false);
  };

  const handlePackageSubmit = () => {
    if (!packageForm.name.trim() || !packageForm.price.trim()) return;
    const inclusions = packageForm.inclusionsRaw.split('\n').map((l) => l.trim()).filter(Boolean);
    const item: PackageItem = {
      id: editingPackageId ?? newId(),
      name: packageForm.name,
      price: packageForm.price,
      inclusions,
      isHighlighted: packageForm.isHighlighted,
      ctaLabel: packageForm.ctaLabel,
    };
    if (editingPackageId) {
      setPackages((prev) => prev.map((p) => p.id === editingPackageId ? item : p));
    } else {
      if (packages.length >= 4) { toast.error('Maximum 4 packages'); return; }
      setPackages((prev) => [...prev, item]);
    }
    resetPackageForm();
  };

  const handlePackageEdit = (item: PackageItem) => {
    setPackageForm({ name: item.name, price: item.price, inclusionsRaw: item.inclusions.join('\n'), isHighlighted: item.isHighlighted, ctaLabel: item.ctaLabel });
    setEditingPackageId(item.id);
    setShowPackageForm(true);
  };

  const handlePackageDelete = (id: string) => setPackages((prev) => prev.filter((p) => p.id !== id));

  const handleSavePackages = async () => {
    setSavingPackages(true);
    try {
      await api.put('/settings/packages', { enabled: packagesEnabled, items: packages, disclaimer: packagesDisclaimer });
      toast.success(t('admin.settings.sections.save_packages'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingPackages(false);
    }
  };

  // ── Handlers: Video ─────────────────────────────────────────────────────────
  const handleSaveVideo = async () => {
    setSavingVideo(true);
    try {
      await api.put('/settings/video', { enabled: videoEnabled, url: video.url, heading: video.heading, subheading: video.subheading });
      toast.success(t('admin.settings.sections.save_video'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingVideo(false);
    }
  };

  // ── Handlers: CTA Banner ────────────────────────────────────────────────────
  const handleSaveCta = async () => {
    setSavingCta(true);
    try {
      await api.put('/settings/cta-banner', { enabled: ctaEnabled, heading: cta.heading, subtext: cta.subtext, buttonLabel: cta.buttonLabel });
      toast.success(t('admin.settings.sections.save_cta'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingCta(false);
    }
  };

  const handleCtaBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCtaBannerImage(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/settings/cta-banner-image', form, { headers: { 'Content-Type': undefined } });
      setCtaBannerImagePreview(getImageUrl(res.data.ctaBannerImagePath));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setUploadingCtaBannerImage(false);
      if (ctaBannerImageRef.current) ctaBannerImageRef.current.value = '';
    }
  };

  const handleCtaBannerImageRemove = async () => {
    setRemovingCtaBannerImage(true);
    try {
      await api.delete('/settings/cta-banner-image');
      setCtaBannerImagePreview('');
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setRemovingCtaBannerImage(false);
    }
  };

  // ── Handlers: Contact Section ───────────────────────────────────────────────
  const handleSaveContactSection = async () => {
    setSavingContactSection(true);
    try {
      await api.put('/settings/contact-section', {
        enabled: contactSectionEnabled,
        heading: contactSection.heading,
        subheading: contactSection.subheading,
      });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingContactSection(false);
    }
  };

  // ── Handlers: Instagram Feed ────────────────────────────────────────────────
  const handleSaveIgFeed = async () => {
    setSavingIgFeed(true);
    try {
      await api.put('/settings/instagram-feed', { enabled: igFeedEnabled, images: igFeedImages });
      toast.success(t('admin.settings.sections.save_instagram_feed'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingIgFeed(false);
    }
  };

  const handleIgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (igFeedImages.length >= 9) {
      toast.error(t('admin.settings.sections.instagram_feed_max'));
      return;
    }
    setUploadingIgImage(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/settings/instagram-feed-image', form, { headers: { 'Content-Type': undefined } });
      setIgFeedImages(res.data.instagramFeedImages);
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.hero_upload_failed'));
    } finally {
      setUploadingIgImage(false);
      if (igFeedInputRef.current) igFeedInputRef.current.value = '';
    }
  };

  const handleIgImageDelete = async (index: number) => {
    try {
      const res = await api.delete(`/settings/instagram-feed-image/${index}`);
      setIgFeedImages(res.data.instagramFeedImages);
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.common.error'));
    }
  };

  // ── Handlers: Stats ────────────────────────────────────────────────────────
  const resetStatForm = () => { setStatForm({ value: 0, suffix: '+', label: '' }); setEditingStatId(null); setShowStatForm(false); };
  const handleStatSubmit = () => {
    if (!statForm.label.trim()) return;
    if (editingStatId) {
      setStats((prev) => prev.map((s) => s.id === editingStatId ? { ...statForm, id: editingStatId } : s));
    } else {
      if (stats.length >= 4) { toast.error('Maximum 4 stats'); return; }
      setStats((prev) => [...prev, { ...statForm, id: newId() }]);
    }
    resetStatForm();
  };
  const handleStatEdit = (item: StatItem) => { setStatForm({ value: item.value, suffix: item.suffix, label: item.label }); setEditingStatId(item.id); setShowStatForm(true); };
  const handleStatDelete = (id: string) => setStats((prev) => prev.filter((s) => s.id !== id));
  const handleSaveStats = async () => {
    setSavingStats(true);
    try {
      await api.put('/settings/stats', { enabled: statsEnabled, items: stats });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch { toast.error(t('admin.settings.landing_failed')); }
    finally { setSavingStats(false); }
  };

  // ── Handlers: Promises ──────────────────────────────────────────────────────
  const resetPromiseForm = () => { setPromiseForm({ icon: 'camera', title: '', description: '' }); setEditingPromiseId(null); setShowPromiseForm(false); };
  const handlePromiseSubmit = () => {
    if (!promiseForm.title.trim()) return;
    if (editingPromiseId) {
      setPromises((prev) => prev.map((p) => p.id === editingPromiseId ? { ...promiseForm, id: editingPromiseId } : p));
    } else {
      if (promises.length >= 4) { toast.error('Maximum 4 promises'); return; }
      setPromises((prev) => [...prev, { ...promiseForm, id: newId() }]);
    }
    resetPromiseForm();
  };
  const handlePromiseEdit = (item: PromiseItem) => { setPromiseForm({ icon: item.icon, title: item.title, description: item.description }); setEditingPromiseId(item.id); setShowPromiseForm(true); };
  const handlePromiseDelete = (id: string) => setPromises((prev) => prev.filter((p) => p.id !== id));
  const handleSavePromises = async () => {
    setSavingPromises(true);
    try {
      await api.put('/settings/promises', { enabled: promisesEnabled, items: promises });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch { toast.error(t('admin.settings.landing_failed')); }
    finally { setSavingPromises(false); }
  };

  // ── Handlers: FAQ ───────────────────────────────────────────────────────────
  const resetFaqForm = () => { setFaqForm({ q: '', a: '' }); setEditingFaqId(null); setShowFaqForm(false); };
  const handleFaqSubmit = () => {
    if (!faqForm.q.trim() || !faqForm.a.trim()) return;
    if (editingFaqId) {
      setFaqItems((prev) => prev.map((f) => f.id === editingFaqId ? { ...faqForm, id: editingFaqId } : f));
    } else {
      if (faqItems.length >= 10) { toast.error('Maximum 10 FAQ items'); return; }
      setFaqItems((prev) => [...prev, { ...faqForm, id: newId() }]);
    }
    resetFaqForm();
  };
  const handleFaqEdit = (item: FaqItem) => { setFaqForm({ q: item.q, a: item.a }); setEditingFaqId(item.id); setShowFaqForm(true); };
  const handleFaqDelete = (id: string) => setFaqItems((prev) => prev.filter((f) => f.id !== id));
  const handleSaveFaq = async () => {
    setSavingFaq(true);
    try {
      await api.put('/settings/faq', { enabled: faqEnabled, items: faqItems });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch { toast.error(t('admin.settings.landing_failed')); }
    finally { setSavingFaq(false); }
  };

  // ── Handlers: Final CTA ─────────────────────────────────────────────────────
  const handleSaveFinalCta = async () => {
    setSavingFinalCta(true);
    try {
      await api.put('/settings/landing', { finalCtaHeading: finalCta.heading, finalCtaSubtext: finalCta.subtext, finalCtaButtonLabel: finalCta.buttonLabel });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch { toast.error(t('admin.settings.landing_failed')); }
    finally { setSavingFinalCta(false); }
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title={t('admin.settings.title')}>
      {/* Tab bar */}
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

      {/* ── Tab 1: Studio Identity ─────────────────────────────────────────── */}
      {activeTab === 'identity' && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl'>
          {/* Account info */}
          <div className='bg-card rounded-xl border border-beige p-6'>
            <h2 className='font-semibold text-charcoal mb-4'>{t('admin.settings.account')}</h2>
            <dl className='space-y-3 text-sm'>
              <div>
                <dt className='text-xs text-warm-gray'>{t('admin.common.name')}</dt>
                <dd className='text-charcoal'>{admin?.name}</dd>
              </div>
              <div>
                <dt className='text-xs text-warm-gray'>{t('admin.common.email')}</dt>
                <dd className='text-charcoal'>{admin?.email}</dd>
              </div>
            </dl>
          </div>

          {/* Studio Profile */}
          <div className='bg-card rounded-xl border border-beige p-6'>
            <h2 className='font-semibold text-charcoal mb-4'>{t('admin.settings.studio_profile')}</h2>
            <form onSubmit={handleProfile} className='space-y-4'>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.display_name')}</label>
                <InputField type='text' value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.studio_name')}</label>
                <InputField type='text' value={profile.studioName} onChange={(e) => setProfile({ ...profile, studioName: e.target.value })} />
              </div>
              {profileMsg && <p className='text-sm text-charcoal'>{profileMsg}</p>}
              <Button type='submit' variant='primary' size='sm' disabled={savingProfile}>
                {savingProfile ? t('admin.common.saving') : t('admin.settings.save_profile')}
              </Button>
            </form>
          </div>

          {/* Studio Logo */}
          <div className='bg-card rounded-xl border border-beige p-6'>
            <h2 className='font-semibold text-charcoal mb-1'>{t('admin.settings.logo_image')}</h2>
            <p className='text-xs text-warm-gray mb-4'>{t('admin.settings.logo_image')}</p>
            <div className='flex items-center gap-4'>
              {logoPreview ? (
                <div className='h-12 flex items-center rounded-lg overflow-hidden border border-beige bg-ivory px-3'>
                  <img src={logoPreview} alt='Studio logo' className='h-8 w-auto object-contain' />
                </div>
              ) : (
                <div className='h-12 w-24 rounded-lg border border-dashed border-beige bg-ivory flex items-center justify-center text-xs text-warm-gray'>
                  No logo
                </div>
              )}
              <div className='flex items-center gap-2'>
                <input ref={logoInputRef} type='file' accept='image/*' className='hidden' onChange={handleLogoUpload} />
                <Button type='button' variant='ghost' size='sm' onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo || removingLogo}>
                  {uploadingLogo ? t('admin.common.uploading') : logoPreview ? t('admin.settings.logo_replace') : t('admin.settings.logo_upload')}
                </Button>
                {logoPreview && (
                  <Button type='button' variant='ghost' size='sm' onClick={handleLogoRemove} disabled={removingLogo || uploadingLogo}>
                    {removingLogo ? '...' : t('admin.settings.logo_remove')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Public page URL */}
          {admin?.id && (
            <div className='bg-card rounded-xl border border-beige p-6'>
              <h2 className='font-semibold text-charcoal mb-4'>{t('admin.settings.public_page_title')}</h2>
              <p className='text-xs text-warm-gray mb-2'>{t('admin.settings.public_page_label')}</p>
              <a href={`/${admin.id}`} target='_blank' rel='noreferrer' className='text-sm text-blush underline font-mono break-all'>
                {window.location.origin}/{admin.id}
              </a>
            </div>
          )}

          {/* Product Catalog */}
          <div className='bg-card rounded-xl border border-beige p-6 lg:col-span-2'>
            <div className='flex items-center justify-between mb-1'>
              <h2 className='font-semibold text-charcoal'>{t('admin.products.catalog_title')}</h2>
              <button
                type='button'
                onClick={() => setShowCatalogForm(true)}
                className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
              >
                <Plus size={13} />
                {t('admin.products.catalog_add')}
              </button>
            </div>
            <p className='text-xs text-warm-gray mb-4'>{t('admin.products.catalog_subtitle')}</p>

            <Modal
              isOpen={showCatalogForm}
              onClose={() => { setShowCatalogForm(false); setCatalogForm({ name: '', type: 'album', maxPhotos: 20 }); }}
              maxWidth='max-w-sm'
            >
              <h3 className='font-semibold text-charcoal mb-4'>{t('admin.products.catalog_add')}</h3>
              <form onSubmit={handleCatalogCreate} className='space-y-4'>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.products.name_label')}</label>
                  <input
                    type='text'
                    value={catalogForm.name}
                    onChange={(e) => setCatalogForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('admin.products.name_ph')}
                    className={fieldClass}
                    required
                    autoFocus
                  />
                </div>
                <div className='flex gap-4'>
                  {(['album', 'print'] as const).map((type) => (
                    <label key={type} className='flex items-center gap-1.5 text-xs text-charcoal cursor-pointer'>
                      <input
                        type='radio'
                        name='catalog-type'
                        checked={catalogForm.type === type}
                        onChange={() => setCatalogForm((f) => ({ ...f, type, maxPhotos: type === 'print' ? 1 : 20 }))}
                        className='accent-blush'
                      />
                      {t(`admin.products.type_${type}`)}
                    </label>
                  ))}
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.products.max_photos')}</label>
                  <input
                    type='number'
                    min={1}
                    max={500}
                    value={catalogForm.maxPhotos}
                    onChange={(e) => setCatalogForm((f) => ({ ...f, maxPhotos: Number(e.target.value) }))}
                    className='w-24 border border-beige rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:border-blush'
                  />
                </div>
                <div className='flex gap-2 pt-2 border-t border-beige'>
                  <button type='submit' disabled={savingCatalog} className='px-3 py-1.5 bg-blush text-white text-xs rounded-xl hover:opacity-90 disabled:opacity-60'>
                    {savingCatalog ? t('admin.common.saving') : t('admin.products.catalog_save')}
                  </button>
                  <button type='button' onClick={() => { setShowCatalogForm(false); setCatalogForm({ name: '', type: 'album', maxPhotos: 20 }); }} className='px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
                    {t('admin.common.cancel')}
                  </button>
                </div>
              </form>
            </Modal>

            {catalogProducts.length === 0 ? (
              <p className='text-xs text-warm-gray'>{t('admin.products.catalog_empty')}</p>
            ) : (
              <ul className='space-y-2'>
                {catalogProducts.map((p: AdminProduct) => (
                  <li key={p.id} className='flex items-center justify-between gap-2 border border-beige rounded-lg px-3 py-2'>
                    <div className='min-w-0'>
                      <span className='text-sm text-charcoal truncate block'>{p.name}</span>
                      <span className='text-xs text-warm-gray'>
                        {t(`admin.products.type_${p.type}`)} · {p.maxPhotos} {t('admin.products.max_photos')}
                      </span>
                    </div>
                    <button
                      type='button'
                      onClick={() => handleCatalogDelete(p.id)}
                      disabled={deletingCatalogId === p.id}
                      className='shrink-0 text-warm-gray hover:text-red-500 transition-colors disabled:opacity-40'
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Hero ────────────────────────────────────────────────────── */}
      {activeTab === 'hero' && (
        <div className='max-w-2xl space-y-6'>
          <div className='bg-card rounded-xl border border-beige p-6 space-y-6'>
            <h2 className='font-semibold text-charcoal'>{t('admin.settings.tab.hero')}</h2>

            {/* Hero image upload */}
            <div>
              <label className='block text-xs text-warm-gray mb-2'>{t('admin.settings.hero_image')}</label>
              <input ref={heroInputRef} type='file' accept='image/*' className='hidden' onChange={handleHeroUpload} />
              <div
                onClick={() => !uploadingHero && heroInputRef.current?.click()}
                className='relative w-full rounded-xl overflow-hidden bg-beige border-2 border-dashed border-beige hover:border-blush/50 transition-colors group cursor-pointer'
                style={{ aspectRatio: '16/7' }}
              >
                {heroPreview ? (
                  <>
                    <img src={heroPreview} alt='Hero preview' className='absolute inset-0 w-full h-full object-cover' />
                    <div className={`absolute inset-0 transition-colors ${
                      hero.heroOverlayOpacity === 'light' ? 'bg-black/10' :
                      hero.heroOverlayOpacity === 'dark'  ? 'bg-black/60' :
                                                            'bg-black/30'
                    }`} />
                    <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white'>
                      <Camera size={24} />
                      <span className='text-sm font-medium'>{t('admin.settings.hero_image_replace')}</span>
                    </div>
                  </>
                ) : (
                  <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 text-warm-gray'>
                    <Camera size={28} />
                    <span className='text-sm'>{t('admin.settings.hero_image_upload')}</span>
                  </div>
                )}
                {uploadingHero && (
                  <div className='absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm'>
                    {t('admin.common.uploading')}
                  </div>
                )}
              </div>
            </div>

            {/* Hero tagline */}
            <div>
              <label className='block text-xs text-warm-gray mb-1'>Tagline above title</label>
              <InputField
                type='text'
                value={heroTagline}
                onChange={(e) => setHeroTagline(e.target.value)}
                placeholder='צלם מקצועי · אירועים ומשפחות'
              />
            </div>

            {/* Hero subtitle */}
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.hero_subtitle')}</label>
              <InputField
                type='text'
                value={hero.heroSubtitle}
                onChange={(e) => setHero({ ...hero, heroSubtitle: e.target.value })}
                placeholder='צילומי משפחה, הריון וניו בורן בצפון הארץ'
              />
            </div>

            {/* Overlay opacity */}
            <div>
              <label className='block text-xs text-warm-gray mb-2'>{t('admin.settings.hero_overlay')}</label>
              <div className='flex gap-2'>
                {(['light', 'medium', 'dark'] as HeroOverlayOpacity[]).map((op) => (
                  <button
                    key={op}
                    type='button'
                    onClick={() => setHero({ ...hero, heroOverlayOpacity: op })}
                    className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${
                      hero.heroOverlayOpacity === op
                        ? 'border-blush bg-blush/10 text-blush font-medium'
                        : 'border-beige text-warm-gray hover:border-blush/50'
                    }`}
                  >
                    {t(`admin.settings.hero_overlay.${op}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA labels */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.hero_cta_primary')}</label>
                <InputField
                  type='text'
                  value={hero.heroCtaPrimaryLabel}
                  onChange={(e) => setHero({ ...hero, heroCtaPrimaryLabel: e.target.value })}
                  placeholder='View Your Gallery / הצג את הגלריה'
                />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.hero_cta_secondary')}</label>
                <InputField
                  type='text'
                  value={hero.heroCtaSecondaryLabel}
                  onChange={(e) => setHero({ ...hero, heroCtaSecondaryLabel: e.target.value })}
                  placeholder='Book a Session / בואו נדבר'
                />
              </div>
            </div>

            <Button type='button' variant='primary' onClick={handleSaveHero} disabled={savingHero}>
              {savingHero ? t('admin.common.saving') : t('admin.settings.save_hero')}
            </Button>
          </div>

          {/* Final CTA Section */}
          <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
            <h2 className='font-semibold text-charcoal'>Final CTA Section</h2>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>Heading</label>
              <InputField type='text' value={finalCta.heading} onChange={(e) => setFinalCta({ ...finalCta, heading: e.target.value })} placeholder='מוכנים לצלם? / Ready to Shoot?' />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>Subtext</label>
              <InputField type='text' value={finalCta.subtext} onChange={(e) => setFinalCta({ ...finalCta, subtext: e.target.value })} placeholder='צרו קשר היום...' />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>Button label</label>
              <InputField type='text' value={finalCta.buttonLabel} onChange={(e) => setFinalCta({ ...finalCta, buttonLabel: e.target.value })} placeholder='שלח הודעה / Send a Message' />
            </div>
            <Button type='button' variant='primary' onClick={handleSaveFinalCta} disabled={savingFinalCta}>
              {savingFinalCta ? t('admin.common.saving') : t('admin.settings.save_hero')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Tab 3: About ───────────────────────────────────────────────────── */}
      {activeTab === 'about' && (
        <div className='max-w-2xl space-y-6'>
          <div className='bg-card rounded-xl border border-beige p-6 space-y-6'>
            <h2 className='font-semibold text-charcoal'>{t('admin.settings.tab.about')}</h2>

            {/* Profile photo */}
            <div>
              <label className='block text-xs text-warm-gray mb-2'>{t('admin.settings.profile_image')}</label>
              {profilePreview && (
                <div className='mb-2 w-24 h-24 rounded-full overflow-hidden bg-beige'>
                  <img src={profilePreview} alt='Profile preview' className='w-full h-full object-cover' />
                </div>
              )}
              <input ref={profileInputRef} type='file' accept='image/*' className='hidden' onChange={handleProfileUpload} />
              <Button type='button' variant='ghost' size='sm' onClick={() => profileInputRef.current?.click()} disabled={uploadingProfile}>
                {uploadingProfile ? t('admin.common.uploading') : profilePreview ? t('admin.settings.profile_image_replace') : t('admin.settings.profile_image_upload')}
              </Button>
            </div>

            {/* About section title */}
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.about_section_title')}</label>
              <InputField
                type='text'
                value={about.aboutSectionTitle}
                onChange={(e) => setAbout({ ...about, aboutSectionTitle: e.target.value })}
                placeholder='About Me / קצת עליי'
              />
            </div>

            {/* Bio */}
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.bio')}</label>
              <TextareaField
                rows={4}
                maxLength={800}
                value={about.bio}
                onChange={(e) => setAbout({ ...about, bio: e.target.value })}
                placeholder={t('admin.settings.bio_placeholder')}
              />
              <p className={`text-xs mt-1 text-right ${about.bio.length >= 800 ? 'text-red-400' : 'text-warm-gray'}`}>
                {about.bio.length} / 800
              </p>
            </div>

            {/* Contact fields */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.phone')}</label>
                <InputField type='text' value={about.phone} onChange={(e) => setAbout({ ...about, phone: e.target.value })} placeholder='050-0000000' />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.contact_email')}</label>
                <InputField type='email' value={about.contactEmail} onChange={(e) => setAbout({ ...about, contactEmail: e.target.value })} placeholder='studio@example.com' />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.instagram')}</label>
                <InputField type='text' value={about.instagramHandle} onChange={(e) => setAbout({ ...about, instagramHandle: e.target.value })} placeholder='@username' />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.facebook')}</label>
                <InputField type='text' value={about.facebookUrl} onChange={(e) => setAbout({ ...about, facebookUrl: e.target.value })} placeholder='https://facebook.com/yourpage' />
              </div>
              <div className='sm:col-span-2'>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.tiktok')}</label>
                <InputField type='text' value={about.tiktokUrl} onChange={(e) => setAbout({ ...about, tiktokUrl: e.target.value })} placeholder='https://tiktok.com/@username' />
              </div>
            </div>

            <Button type='button' variant='primary' onClick={handleSaveAbout} disabled={savingAbout}>
              {savingAbout ? t('admin.common.saving') : t('admin.settings.save_about')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Tab 4: Sections ────────────────────────────────────────────────── */}
      {activeTab === 'sections' && (
        <div className='space-y-6 max-w-3xl'>

          {/* 4a: Services */}
          <SectionCard
            title={t('admin.settings.sections.services')}
            enabled={servicesEnabled}
            onToggle={() => setServicesEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSaveServices}
            saveLabel={t('admin.settings.sections.save_services')}
            saving={savingServices}
          >
            <ul className='space-y-2'>
              {services.map((item, i) => {
                const IconComp = SERVICE_ICONS.find((ic) => ic.name === item.icon)?.Icon ?? Camera;
                return (
                  <li key={item.id} className='flex items-start gap-2 border border-beige rounded-lg px-3 py-2'>
                    <IconComp size={16} className='mt-0.5 text-blush shrink-0' />
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-charcoal truncate'>{item.title}</p>
                      {item.startingPrice && <p className='text-xs text-warm-gray'>{item.startingPrice}</p>}
                    </div>
                    <div className='flex items-center gap-1 shrink-0'>
                      <button type='button' onClick={() => moveService(i, -1)} disabled={i === 0} className='p-1 text-warm-gray hover:text-charcoal disabled:opacity-30'>
                        <ChevronUp size={14} />
                      </button>
                      <button type='button' onClick={() => moveService(i, 1)} disabled={i === services.length - 1} className='p-1 text-warm-gray hover:text-charcoal disabled:opacity-30'>
                        <ChevronDown size={14} />
                      </button>
                      <button type='button' onClick={() => handleServiceEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                        <Pencil size={14} />
                      </button>
                      <button type='button' onClick={() => handleServiceDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {showServiceForm ? (
              <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
                <ServiceIconPicker value={serviceForm.icon} onChange={(v) => setServiceForm((f) => ({ ...f, icon: v }))} />
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.title')}</label>
                  <input className={fieldClass} value={serviceForm.title} onChange={(e) => setServiceForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.description')}</label>
                  <textarea className={`${fieldClass} resize-none`} rows={3} value={serviceForm.description} onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.starting_price')}</label>
                  <input className={fieldClass} value={serviceForm.startingPrice} onChange={(e) => setServiceForm((f) => ({ ...f, startingPrice: e.target.value }))} />
                </div>
                <div className='flex gap-2 pt-1'>
                  <button type='button' onClick={handleServiceSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
                    <Check size={13} /> {t('admin.common.save') || 'Save'}
                  </button>
                  <button type='button' onClick={resetServiceForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
                    <X size={13} /> {t('admin.common.cancel')}
                  </button>
                </div>
              </div>
            ) : services.length < 8 && (
              <button
                type='button'
                onClick={() => { setEditingServiceId(null); setShowServiceForm(true); }}
                className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
              >
                <Plus size={13} /> {t('admin.settings.sections.add_service')}
              </button>
            )}
          </SectionCard>

          {/* 4b: Testimonials */}
          <SectionCard
            title={t('admin.settings.sections.testimonials')}
            enabled={testimonialsEnabled}
            onToggle={() => setTestimonialsEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSaveTestimonials}
            saveLabel={t('admin.settings.sections.save_testimonials')}
            saving={savingTestimonials}
          >
            <ul className='space-y-2'>
              {testimonials.map((item, i) => (
                <li key={item.id} className='flex items-start gap-2 border border-beige rounded-lg px-3 py-2'>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm text-charcoal line-clamp-2'>{item.text}</p>
                    <p className='text-xs text-warm-gray mt-0.5'>{item.clientName}{item.rating ? ` · ${'★'.repeat(item.rating)}` : ''}</p>
                  </div>
                  <div className='flex items-center gap-1 shrink-0'>
                    <button type='button' onClick={() => moveTestimonial(i, -1)} disabled={i === 0} className='p-1 text-warm-gray hover:text-charcoal disabled:opacity-30'>
                      <ChevronUp size={14} />
                    </button>
                    <button type='button' onClick={() => moveTestimonial(i, 1)} disabled={i === testimonials.length - 1} className='p-1 text-warm-gray hover:text-charcoal disabled:opacity-30'>
                      <ChevronDown size={14} />
                    </button>
                    <button type='button' onClick={() => handleTestimonialEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                      <Pencil size={14} />
                    </button>
                    <button type='button' onClick={() => handleTestimonialDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {showTestimonialForm ? (
              <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.client_name')}</label>
                  <input className={fieldClass} value={testimonialForm.clientName} onChange={(e) => setTestimonialForm((f) => ({ ...f, clientName: e.target.value }))} />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.description')}</label>
                  <textarea className={`${fieldClass} resize-none`} rows={3} value={testimonialForm.text} onChange={(e) => setTestimonialForm((f) => ({ ...f, text: e.target.value }))} />
                </div>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.session_type')}</label>
                    <select className={fieldClass} value={testimonialForm.sessionType} onChange={(e) => setTestimonialForm((f) => ({ ...f, sessionType: e.target.value }))}>
                      <option value=''>—</option>
                      {SESSION_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.rating')}</label>
                    <select className={fieldClass} value={testimonialForm.rating ?? ''} onChange={(e) => setTestimonialForm((f) => ({ ...f, rating: e.target.value ? Number(e.target.value) : null }))}>
                      <option value=''>—</option>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
                    </select>
                  </div>
                </div>
                <div className='flex gap-2 pt-1'>
                  <button type='button' onClick={handleTestimonialSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
                    <Check size={13} /> {t('admin.common.save') || 'Save'}
                  </button>
                  <button type='button' onClick={resetTestimonialForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
                    <X size={13} /> {t('admin.common.cancel')}
                  </button>
                </div>
              </div>
            ) : testimonials.length < 12 && (
              <button
                type='button'
                onClick={() => { setEditingTestimonialId(null); setShowTestimonialForm(true); }}
                className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
              >
                <Plus size={13} /> {t('admin.settings.sections.add_testimonial')}
              </button>
            )}
          </SectionCard>

          {/* 4c: Packages */}
          <SectionCard
            title={t('admin.settings.sections.packages')}
            enabled={packagesEnabled}
            onToggle={() => setPackagesEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSavePackages}
            saveLabel={t('admin.settings.sections.save_packages')}
            saving={savingPackages}
          >
            <ul className='space-y-2'>
              {packages.map((item) => (
                <li key={item.id} className='flex items-start gap-2 border border-beige rounded-lg px-3 py-2'>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-charcoal flex items-center gap-2'>
                      {item.name}
                      {item.isHighlighted && <span className='text-[10px] bg-blush/20 text-blush px-1.5 py-0.5 rounded-full'>Popular</span>}
                    </p>
                    <p className='text-xs text-warm-gray'>{item.price}</p>
                  </div>
                  <div className='flex items-center gap-1 shrink-0'>
                    <button type='button' onClick={() => handlePackageEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                      <Pencil size={14} />
                    </button>
                    <button type='button' onClick={() => handlePackageDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {showPackageForm ? (
              <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.package_name')}</label>
                    <input className={fieldClass} value={packageForm.name} onChange={(e) => setPackageForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.price')}</label>
                    <input className={fieldClass} value={packageForm.price} onChange={(e) => setPackageForm((f) => ({ ...f, price: e.target.value }))} placeholder='Starting from ₪1,500' />
                  </div>
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.inclusions')}</label>
                  <textarea className={`${fieldClass} resize-none`} rows={4} value={packageForm.inclusionsRaw} onChange={(e) => setPackageForm((f) => ({ ...f, inclusionsRaw: e.target.value }))} />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.cta_label')}</label>
                  <input className={fieldClass} value={packageForm.ctaLabel} onChange={(e) => setPackageForm((f) => ({ ...f, ctaLabel: e.target.value }))} />
                </div>
                <label className='flex items-center gap-2 text-xs text-charcoal cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={packageForm.isHighlighted}
                    onChange={(e) => setPackageForm((f) => ({ ...f, isHighlighted: e.target.checked }))}
                    className='accent-blush'
                  />
                  {t('admin.settings.sections.highlight')}
                </label>
                <div className='flex gap-2 pt-1'>
                  <button type='button' onClick={handlePackageSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
                    <Check size={13} /> {t('admin.common.save') || 'Save'}
                  </button>
                  <button type='button' onClick={resetPackageForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
                    <X size={13} /> {t('admin.common.cancel')}
                  </button>
                </div>
              </div>
            ) : packages.length < 4 && (
              <button
                type='button'
                onClick={() => { setEditingPackageId(null); setShowPackageForm(true); }}
                className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
              >
                <Plus size={13} /> {t('admin.settings.sections.add_package')}
              </button>
            )}

            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.disclaimer')}</label>
              <input
                className={fieldClass}
                value={packagesDisclaimer}
                onChange={(e) => setPackagesDisclaimer(e.target.value)}
                placeholder='* Prices may vary depending on location'
              />
            </div>
          </SectionCard>

          {/* 4d: Video Reel */}
          <SectionCard
            title={t('admin.settings.sections.video')}
            enabled={videoEnabled}
            onToggle={() => setVideoEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSaveVideo}
            saveLabel={t('admin.settings.sections.save_video')}
            saving={savingVideo}
          >
            <div className='space-y-3'>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.section_heading')}</label>
                <input className={fieldClass} value={video.heading} onChange={(e) => setVideo((v) => ({ ...v, heading: e.target.value }))} />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.section_subheading')}</label>
                <input className={fieldClass} value={video.subheading} onChange={(e) => setVideo((v) => ({ ...v, subheading: e.target.value }))} />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.video_url')}</label>
                <input className={fieldClass} value={video.url} onChange={(e) => setVideo((v) => ({ ...v, url: e.target.value }))} placeholder='https://youtube.com/watch?v=...' />
              </div>
            </div>
          </SectionCard>

          {/* 4e: CTA Banner */}
          <SectionCard
            title={t('admin.settings.sections.cta_banner')}
            enabled={ctaEnabled}
            onToggle={() => setCtaEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSaveCta}
            saveLabel={t('admin.settings.sections.save_cta')}
            saving={savingCta}
          >
            <div className='space-y-3'>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.banner_image')}</label>
                <input ref={ctaBannerImageRef} type='file' accept='image/*' className='hidden' onChange={handleCtaBannerImageUpload} />
                <div
                  onClick={() => !uploadingCtaBannerImage && !removingCtaBannerImage && ctaBannerImageRef.current?.click()}
                  className='relative w-full rounded-xl overflow-hidden bg-beige border-2 border-dashed border-beige hover:border-blush/50 transition-colors group cursor-pointer mb-2'
                  style={{ aspectRatio: '16/5' }}
                >
                  {ctaBannerImagePreview ? (
                    <>
                      <img src={ctaBannerImagePreview} alt='Banner preview' className='absolute inset-0 w-full h-full object-cover' />
                      <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white'>
                        <Camera size={20} />
                        <span className='text-xs font-medium'>{t('admin.settings.hero_image_replace')}</span>
                      </div>
                    </>
                  ) : (
                    <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 text-warm-gray'>
                      <Camera size={22} />
                      <span className='text-xs'>{uploadingCtaBannerImage ? t('admin.common.uploading') : t('admin.settings.sections.banner_image_upload')}</span>
                    </div>
                  )}
                  {uploadingCtaBannerImage && (
                    <div className='absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs'>
                      {t('admin.common.uploading')}
                    </div>
                  )}
                </div>
                {ctaBannerImagePreview && (
                  <button
                    type='button'
                    onClick={handleCtaBannerImageRemove}
                    disabled={removingCtaBannerImage}
                    className='text-xs text-warm-gray hover:text-red-500 transition-colors disabled:opacity-40'
                  >
                    {removingCtaBannerImage ? '...' : t('admin.settings.logo_remove')}
                  </button>
                )}
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.banner_heading')}</label>
                <input className={fieldClass} value={cta.heading} onChange={(e) => setCta((c) => ({ ...c, heading: e.target.value }))} />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.banner_subtext')}</label>
                <input className={fieldClass} value={cta.subtext} onChange={(e) => setCta((c) => ({ ...c, subtext: e.target.value }))} />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.banner_button')}</label>
                <input className={fieldClass} value={cta.buttonLabel} onChange={(e) => setCta((c) => ({ ...c, buttonLabel: e.target.value }))} />
              </div>
            </div>
          </SectionCard>

          {/* 4f: Contact Section */}
          <SectionCard
            title={t('admin.settings.contact_section')}
            enabled={contactSectionEnabled}
            onToggle={() => setContactSectionEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSaveContactSection}
            saveLabel={t('admin.settings.contact_section_save')}
            saving={savingContactSection}
          >
            <div className='space-y-3'>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.contact_section_heading')}</label>
                <input
                  className={fieldClass}
                  maxLength={120}
                  value={contactSection.heading}
                  onChange={(e) => setContactSection((c) => ({ ...c, heading: e.target.value }))}
                />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.contact_section_subheading')}</label>
                <textarea
                  className={`${fieldClass} resize-none`}
                  rows={3}
                  maxLength={300}
                  value={contactSection.subheading}
                  onChange={(e) => setContactSection((c) => ({ ...c, subheading: e.target.value }))}
                />
              </div>
            </div>
          </SectionCard>

          {/* 4g: Instagram Feed */}
          <SectionCard
            title={t('admin.settings.sections.instagram_feed')}
            enabled={igFeedEnabled}
            onToggle={() => setIgFeedEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSaveIgFeed}
            saveLabel={t('admin.settings.sections.save_instagram_feed')}
            saving={savingIgFeed}
          >
            <div className='space-y-3'>
              <p className='text-xs text-warm-gray'>{t('admin.settings.sections.instagram_feed_max')}</p>
              {igFeedImages.length > 0 && (
                <div className='grid grid-cols-3 gap-2'>
                  {igFeedImages.map((path, idx) => (
                    <div key={idx} className='relative aspect-square rounded-lg overflow-hidden bg-beige group'>
                      <img src={getImageUrl(path)} alt='' className='w-full h-full object-cover' />
                      <button
                        type='button'
                        onClick={() => handleIgImageDelete(idx)}
                        className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white'
                        aria-label='Remove'
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {igFeedImages.length < 9 && (
                <>
                  <input ref={igFeedInputRef} type='file' accept='image/*' className='hidden' onChange={handleIgImageUpload} />
                  <Button type='button' variant='ghost' size='sm' onClick={() => igFeedInputRef.current?.click()} disabled={uploadingIgImage}>
                    {uploadingIgImage ? t('admin.common.uploading') : t('admin.settings.sections.add_instagram_image')}
                  </Button>
                </>
              )}
            </div>
          </SectionCard>

          {/* 4h: Stats */}
          <SectionCard
            title='Stats Strip'
            enabled={statsEnabled}
            onToggle={() => setStatsEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSaveStats}
            saveLabel={t('admin.settings.landing_saved') ? 'Save Stats' : 'Save Stats'}
            saving={savingStats}
          >
            <ul className='space-y-2'>
              {stats.map((item) => (
                <li key={item.id} className='flex items-center gap-2 border border-beige rounded-lg px-3 py-2'>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-charcoal'>
                      {item.value}{item.suffix}
                    </p>
                    <p className='text-xs text-warm-gray truncate'>{item.label}</p>
                  </div>
                  <div className='flex items-center gap-1 shrink-0'>
                    <button type='button' onClick={() => handleStatEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                      <Pencil size={14} />
                    </button>
                    <button type='button' onClick={() => handleStatDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {showStatForm ? (
              <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className='block text-xs text-warm-gray mb-1'>Value</label>
                    <input
                      type='number'
                      className={fieldClass}
                      value={statForm.value}
                      onChange={(e) => setStatForm((f) => ({ ...f, value: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className='block text-xs text-warm-gray mb-1'>Suffix</label>
                    <input
                      className={fieldClass}
                      value={statForm.suffix}
                      maxLength={5}
                      onChange={(e) => setStatForm((f) => ({ ...f, suffix: e.target.value }))}
                      placeholder='+ or %'
                    />
                  </div>
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>Label</label>
                  <input
                    className={fieldClass}
                    value={statForm.label}
                    onChange={(e) => setStatForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder='Happy Families / משפחות מרוצות'
                  />
                </div>
                <div className='flex gap-2 pt-1'>
                  <button type='button' onClick={handleStatSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
                    <Check size={13} /> Save
                  </button>
                  <button type='button' onClick={resetStatForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
                    <X size={13} /> {t('admin.common.cancel')}
                  </button>
                </div>
              </div>
            ) : stats.length < 4 && (
              <button
                type='button'
                onClick={() => { setEditingStatId(null); setShowStatForm(true); }}
                className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
              >
                <Plus size={13} /> Add stat
              </button>
            )}
          </SectionCard>

          {/* 4i: Promises */}
          <SectionCard
            title='Why Choose Us (Promises)'
            enabled={promisesEnabled}
            onToggle={() => setPromisesEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSavePromises}
            saveLabel='Save Promises'
            saving={savingPromises}
          >
            <ul className='space-y-2'>
              {promises.map((item) => {
                const IconComp = SERVICE_ICONS.find((ic) => ic.name === item.icon)?.Icon ?? Camera;
                return (
                  <li key={item.id} className='flex items-start gap-2 border border-beige rounded-lg px-3 py-2'>
                    <IconComp size={16} className='mt-0.5 text-blush shrink-0' />
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-charcoal truncate'>{item.title}</p>
                      <p className='text-xs text-warm-gray truncate'>{item.description}</p>
                    </div>
                    <div className='flex items-center gap-1 shrink-0'>
                      <button type='button' onClick={() => handlePromiseEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                        <Pencil size={14} />
                      </button>
                      <button type='button' onClick={() => handlePromiseDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {showPromiseForm ? (
              <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
                <ServiceIconPicker value={promiseForm.icon} onChange={(v) => setPromiseForm((f) => ({ ...f, icon: v }))} />
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.title')}</label>
                  <input className={fieldClass} value={promiseForm.title} onChange={(e) => setPromiseForm((f) => ({ ...f, title: e.target.value }))} placeholder='Uncompromising Quality' />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.description')}</label>
                  <textarea className={`${fieldClass} resize-none`} rows={3} value={promiseForm.description} onChange={(e) => setPromiseForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className='flex gap-2 pt-1'>
                  <button type='button' onClick={handlePromiseSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
                    <Check size={13} /> Save
                  </button>
                  <button type='button' onClick={resetPromiseForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
                    <X size={13} /> {t('admin.common.cancel')}
                  </button>
                </div>
              </div>
            ) : promises.length < 4 && (
              <button
                type='button'
                onClick={() => { setEditingPromiseId(null); setShowPromiseForm(true); }}
                className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
              >
                <Plus size={13} /> Add promise
              </button>
            )}
          </SectionCard>

          {/* 4j: FAQ */}
          <SectionCard
            title='FAQ'
            enabled={faqEnabled}
            onToggle={() => setFaqEnabled((v) => !v)}
            enabledLabel={t('admin.settings.sections.enabled')}
            onSave={handleSaveFaq}
            saveLabel='Save FAQ'
            saving={savingFaq}
          >
            <ul className='space-y-2'>
              {faqItems.map((item) => (
                <li key={item.id} className='flex items-start gap-2 border border-beige rounded-lg px-3 py-2'>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm text-charcoal line-clamp-1'>{item.q}</p>
                    <p className='text-xs text-warm-gray line-clamp-1 mt-0.5'>{item.a}</p>
                  </div>
                  <div className='flex items-center gap-1 shrink-0'>
                    <button type='button' onClick={() => handleFaqEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                      <Pencil size={14} />
                    </button>
                    <button type='button' onClick={() => handleFaqDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {showFaqForm ? (
              <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>Question</label>
                  <input className={fieldClass} value={faqForm.q} onChange={(e) => setFaqForm((f) => ({ ...f, q: e.target.value }))} placeholder='How long does it take...' />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>Answer</label>
                  <textarea className={`${fieldClass} resize-none`} rows={4} value={faqForm.a} onChange={(e) => setFaqForm((f) => ({ ...f, a: e.target.value }))} />
                </div>
                <div className='flex gap-2 pt-1'>
                  <button type='button' onClick={handleFaqSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
                    <Check size={13} /> Save
                  </button>
                  <button type='button' onClick={resetFaqForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
                    <X size={13} /> {t('admin.common.cancel')}
                  </button>
                </div>
              </div>
            ) : faqItems.length < 10 && (
              <button
                type='button'
                onClick={() => { setEditingFaqId(null); setShowFaqForm(true); }}
                className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
              >
                <Plus size={13} /> Add FAQ item
              </button>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Tab 5: System ──────────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        <div className='max-w-md space-y-4'>
          {/* Theme */}
          <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
            <h2 className='font-semibold text-charcoal'>{t('admin.settings.theme_label')}</h2>
            <ThemePicker
              value={systemTheme}
              onChange={setSystemTheme}
              label={t('admin.settings.theme_label')}
              getLabel={(key) => t(`theme.${key}`)}
            />
            <div className='pt-2 border-t border-beige'>
              <Button type='button' variant='primary' size='sm' onClick={handleSaveTheme} disabled={savingTheme}>
                {savingTheme ? t('admin.common.saving') : t('admin.common.save')}
              </Button>
            </div>
          </div>

          {/* Notifications */}
          <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
            <h2 className='font-semibold text-charcoal'>{t('admin.settings.notifications')}</h2>
            <label className='flex items-start gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={autoSendEmail}
                onChange={(e) => setAutoSendEmail(e.target.checked)}
                className='mt-0.5 h-4 w-4 rounded border-beige accent-blush cursor-pointer'
              />
              <div>
                <span className='text-sm text-charcoal'>{t('admin.settings.auto_send_email')}</span>
                <p className='text-xs text-warm-gray mt-0.5'>{t('admin.settings.auto_send_email_desc')}</p>
              </div>
            </label>
            <label className='flex items-start gap-3 cursor-pointer'>
              <input
                type='checkbox'
                checked={autoSendSms}
                onChange={(e) => setAutoSendSms(e.target.checked)}
                className='mt-0.5 h-4 w-4 rounded border-beige accent-blush cursor-pointer'
              />
              <div>
                <span className='text-sm text-charcoal'>{t('admin.settings.auto_send_sms')}</span>
                <p className='text-xs text-warm-gray mt-0.5'>{t('admin.settings.auto_send_sms_desc')}</p>
              </div>
            </label>
            <div className='pt-2 border-t border-beige'>
              <Button type='button' variant='primary' size='sm' onClick={handleSaveNotifications} disabled={savingNotifications}>
                {savingNotifications ? t('admin.common.saving') : t('admin.common.save')}
              </Button>
            </div>
          </div>

          {/* System info */}
          <div className='bg-card rounded-xl border border-beige p-6'>
            <h2 className='font-semibold text-charcoal mb-4'>{t('admin.settings.system')}</h2>
            <dl className='space-y-2 text-sm'>
              <div>
                <dt className='text-xs text-warm-gray'>{t('admin.settings.api_server')}</dt>
                <dd className='text-charcoal font-mono text-xs'>{import.meta.env.VITE_API_URL || 'http://localhost:5000'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
      {/* ── Tab 6: Security ───────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className='max-w-md space-y-4'>
          <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
            <h2 className='font-semibold text-charcoal'>{t('admin.settings.sso.title')}</h2>
            <p className='text-sm text-warm-gray'>{t('admin.settings.sso.description')}</p>

            {/* Connection status */}
            <div className='flex items-center gap-2 py-2'>
              {admin?.googleEmail ? (
                <>
                  <span className='inline-flex h-2 w-2 rounded-full bg-green-500 shrink-0' />
                  <span className='text-sm text-charcoal'>
                    {t('admin.settings.sso.connected')} — <span className='font-mono text-xs'>{admin.googleEmail}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className='inline-flex h-2 w-2 rounded-full bg-zinc-300 shrink-0' />
                  <span className='text-sm text-warm-gray'>{t('admin.settings.sso.not_connected')}</span>
                </>
              )}
            </div>

            {/* Actions */}
            <div className='pt-2 border-t border-beige flex flex-wrap gap-2'>
              {admin?.googleEmail ? (
                <button
                  type='button'
                  onClick={handleDisconnectSSO}
                  disabled={disconnectingSSO}
                  className='px-4 py-2 text-sm rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50'
                >
                  {disconnectingSSO ? t('admin.settings.sso.disconnecting') : t('admin.settings.sso.disconnect')}
                </button>
              ) : (
                <button
                  type='button'
                  onClick={handleConnectGoogle}
                  className='flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors'
                >
                  {/* Google G logo */}
                  <svg width='16' height='16' viewBox='0 0 24 24' aria-hidden='true'>
                    <path d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' fill='#4285F4' />
                    <path d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' fill='#34A853' />
                    <path d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z' fill='#FBBC05' />
                    <path d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' fill='#EA4335' />
                  </svg>
                  {t('admin.settings.sso.connect')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
