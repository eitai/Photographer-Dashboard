import { useRef, useState } from 'react';
import {
  Camera,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { useI18n } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useQueries';
import api, { getImageUrl } from '@/lib/api';
import { toast } from 'sonner';
import {
  SectionCard,
  ServiceIconPicker,
  SERVICE_ICONS,
  SESSION_TYPE_OPTIONS,
  fieldClass,
  newId,
  type ServiceItem,
  type TestimonialItem,
  type PackageItem,
  type StatItem,
  type PromiseItem,
  type FaqItem,
} from './settingsComponents';

interface SettingsSectionsTabProps {
  servicesEnabled: boolean;
  setServicesEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  services: ServiceItem[];
  setServices: React.Dispatch<React.SetStateAction<ServiceItem[]>>;

  testimonialsEnabled: boolean;
  setTestimonialsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  testimonials: TestimonialItem[];
  setTestimonials: React.Dispatch<React.SetStateAction<TestimonialItem[]>>;

  packagesEnabled: boolean;
  setPackagesEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  packages: PackageItem[];
  setPackages: React.Dispatch<React.SetStateAction<PackageItem[]>>;
  packagesDisclaimer: string;
  setPackagesDisclaimer: React.Dispatch<React.SetStateAction<string>>;

  videoEnabled: boolean;
  setVideoEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  video: { url: string; heading: string; subheading: string };
  setVideo: React.Dispatch<React.SetStateAction<{ url: string; heading: string; subheading: string }>>;

  ctaEnabled: boolean;
  setCtaEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  cta: { heading: string; subtext: string; buttonLabel: string };
  setCta: React.Dispatch<React.SetStateAction<{ heading: string; subtext: string; buttonLabel: string }>>;
  ctaBannerImagePreview: string;
  setCtaBannerImagePreview: React.Dispatch<React.SetStateAction<string>>;

  contactSectionEnabled: boolean;
  setContactSectionEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  contactSection: { heading: string; subheading: string };
  setContactSection: React.Dispatch<React.SetStateAction<{ heading: string; subheading: string }>>;

  igFeedEnabled: boolean;
  setIgFeedEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  igFeedImages: string[];
  setIgFeedImages: React.Dispatch<React.SetStateAction<string[]>>;

  statsEnabled: boolean;
  setStatsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  stats: StatItem[];
  setStats: React.Dispatch<React.SetStateAction<StatItem[]>>;

  promisesEnabled: boolean;
  setPromisesEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  promises: PromiseItem[];
  setPromises: React.Dispatch<React.SetStateAction<PromiseItem[]>>;

  faqEnabled: boolean;
  setFaqEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  faqItems: FaqItem[];
  setFaqItems: React.Dispatch<React.SetStateAction<FaqItem[]>>;
}

export const SettingsSectionsTab = ({
  servicesEnabled, setServicesEnabled, services, setServices,
  testimonialsEnabled, setTestimonialsEnabled, testimonials, setTestimonials,
  packagesEnabled, setPackagesEnabled, packages, setPackages, packagesDisclaimer, setPackagesDisclaimer,
  videoEnabled, setVideoEnabled, video, setVideo,
  ctaEnabled, setCtaEnabled, cta, setCta, ctaBannerImagePreview, setCtaBannerImagePreview,
  contactSectionEnabled, setContactSectionEnabled, contactSection, setContactSection,
  igFeedEnabled, setIgFeedEnabled, igFeedImages, setIgFeedImages,
  statsEnabled, setStatsEnabled, stats, setStats,
  promisesEnabled, setPromisesEnabled, promises, setPromises,
  faqEnabled, setFaqEnabled, faqItems, setFaqItems,
}: SettingsSectionsTabProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const ctaBannerImageRef = useRef<HTMLInputElement>(null);
  const igFeedInputRef = useRef<HTMLInputElement>(null);

  const [savingServices, setSavingServices] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<Omit<ServiceItem, 'id'>>({
    icon: 'camera', title: '', description: '', startingPrice: '', sessionTypeValue: '',
  });

  const [savingTestimonials, setSavingTestimonials] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<Omit<TestimonialItem, 'id'>>({
    text: '', clientName: '', sessionType: '', rating: null,
  });

  const [savingPackages, setSavingPackages] = useState(false);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState<Omit<PackageItem, 'id' | 'inclusions'> & { inclusionsRaw: string }>({
    name: '', price: '', inclusionsRaw: '', isHighlighted: false, ctaLabel: '',
  });

  const [savingVideo, setSavingVideo] = useState(false);

  const [savingCta, setSavingCta] = useState(false);
  const [uploadingCtaBannerImage, setUploadingCtaBannerImage] = useState(false);
  const [removingCtaBannerImage, setRemovingCtaBannerImage] = useState(false);

  const [savingContactSection, setSavingContactSection] = useState(false);

  const [savingIgFeed, setSavingIgFeed] = useState(false);
  const [uploadingIgImage, setUploadingIgImage] = useState(false);

  const [savingStats, setSavingStats] = useState(false);
  const [showStatForm, setShowStatForm] = useState(false);
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [statForm, setStatForm] = useState({ value: 0, suffix: '+', label: '' });

  const [savingPromises, setSavingPromises] = useState(false);
  const [showPromiseForm, setShowPromiseForm] = useState(false);
  const [editingPromiseId, setEditingPromiseId] = useState<string | null>(null);
  const [promiseForm, setPromiseForm] = useState({ icon: 'camera', title: '', description: '' });

  const [savingFaq, setSavingFaq] = useState(false);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqForm, setFaqForm] = useState({ q: '', a: '' });

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
      if (services.length >= 8) { toast.error(t('admin.settings.max_services')); return; }
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

  const resetTestimonialForm = () => {
    setTestimonialForm({ text: '', clientName: '', sessionType: '', rating: null });
    setEditingTestimonialId(null);
    setShowTestimonialForm(false);
  };

  const handleTestimonialSubmit = () => {
    if (!testimonialForm.text.trim() || !testimonialForm.clientName.trim()) return;
    if (editingTestimonialId) {
      setTestimonials((prev) => prev.map((item) => item.id === editingTestimonialId ? { ...testimonialForm, id: editingTestimonialId } : item));
    } else {
      if (testimonials.length >= 12) { toast.error(t('admin.settings.max_testimonials')); return; }
      setTestimonials((prev) => [...prev, { ...testimonialForm, id: newId() }]);
    }
    resetTestimonialForm();
  };

  const handleTestimonialEdit = (item: TestimonialItem) => {
    setTestimonialForm({ text: item.text, clientName: item.clientName, sessionType: item.sessionType, rating: item.rating });
    setEditingTestimonialId(item.id);
    setShowTestimonialForm(true);
  };

  const handleTestimonialDelete = (id: string) => setTestimonials((prev) => prev.filter((item) => item.id !== id));

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
      if (packages.length >= 4) { toast.error(t('admin.settings.max_packages')); return; }
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

  const resetStatForm = () => { setStatForm({ value: 0, suffix: '+', label: '' }); setEditingStatId(null); setShowStatForm(false); };
  const handleStatSubmit = () => {
    if (!statForm.label.trim()) return;
    if (editingStatId) {
      setStats((prev) => prev.map((s) => s.id === editingStatId ? { ...statForm, id: editingStatId } : s));
    } else {
      if (stats.length >= 4) { toast.error(t('admin.settings.max_stats')); return; }
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

  const resetPromiseForm = () => { setPromiseForm({ icon: 'camera', title: '', description: '' }); setEditingPromiseId(null); setShowPromiseForm(false); };
  const handlePromiseSubmit = () => {
    if (!promiseForm.title.trim()) return;
    if (editingPromiseId) {
      setPromises((prev) => prev.map((p) => p.id === editingPromiseId ? { ...promiseForm, id: editingPromiseId } : p));
    } else {
      if (promises.length >= 4) { toast.error(t('admin.settings.max_promises')); return; }
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

  const resetFaqForm = () => { setFaqForm({ q: '', a: '' }); setEditingFaqId(null); setShowFaqForm(false); };
  const handleFaqSubmit = () => {
    if (!faqForm.q.trim() || !faqForm.a.trim()) return;
    if (editingFaqId) {
      setFaqItems((prev) => prev.map((f) => f.id === editingFaqId ? { ...faqForm, id: editingFaqId } : f));
    } else {
      if (faqItems.length >= 10) { toast.error(t('admin.settings.max_faq')); return; }
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

  return (
    <div className='space-y-6 max-w-3xl'>

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
                <Check size={13} /> {t('admin.common.save')}
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
                <Check size={13} /> {t('admin.common.save')}
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
                <Check size={13} /> {t('admin.common.save')}
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
                    aria-label={t('admin.settings.sections.remove')}
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

      <SectionCard
        title={t('admin.settings.sections.stats')}
        enabled={statsEnabled}
        onToggle={() => setStatsEnabled((v) => !v)}
        enabledLabel={t('admin.settings.sections.enabled')}
        onSave={handleSaveStats}
        saveLabel={t('admin.settings.sections.save_stats')}
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
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.stat_value')}</label>
                <input
                  type='number'
                  className={fieldClass}
                  value={statForm.value}
                  onChange={(e) => setStatForm((f) => ({ ...f, value: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.stat_suffix')}</label>
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
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.stat_label')}</label>
              <input
                className={fieldClass}
                value={statForm.label}
                onChange={(e) => setStatForm((f) => ({ ...f, label: e.target.value }))}
                placeholder='Happy Families / משפחות מרוצות'
              />
            </div>
            <div className='flex gap-2 pt-1'>
              <button type='button' onClick={handleStatSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
                <Check size={13} /> {t('admin.common.save')}
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
            <Plus size={13} /> {t('admin.settings.sections.add_stat')}
          </button>
        )}
      </SectionCard>

      <SectionCard
        title={t('admin.settings.sections.promises')}
        enabled={promisesEnabled}
        onToggle={() => setPromisesEnabled((v) => !v)}
        enabledLabel={t('admin.settings.sections.enabled')}
        onSave={handleSavePromises}
        saveLabel={t('admin.settings.sections.save_promises')}
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
                <Check size={13} /> {t('admin.common.save')}
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
            <Plus size={13} /> {t('admin.settings.sections.add_promise')}
          </button>
        )}
      </SectionCard>

      <SectionCard
        title={t('admin.settings.sections.faq')}
        enabled={faqEnabled}
        onToggle={() => setFaqEnabled((v) => !v)}
        enabledLabel={t('admin.settings.sections.enabled')}
        onSave={handleSaveFaq}
        saveLabel={t('admin.settings.sections.save_faq')}
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
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.faq_question')}</label>
              <input className={fieldClass} value={faqForm.q} onChange={(e) => setFaqForm((f) => ({ ...f, q: e.target.value }))} placeholder='How long does it take...' />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.faq_answer')}</label>
              <textarea className={`${fieldClass} resize-none`} rows={4} value={faqForm.a} onChange={(e) => setFaqForm((f) => ({ ...f, a: e.target.value }))} />
            </div>
            <div className='flex gap-2 pt-1'>
              <button type='button' onClick={handleFaqSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
                <Check size={13} /> {t('admin.common.save')}
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
            <Plus size={13} /> {t('admin.settings.sections.add_faq')}
          </button>
        )}
      </SectionCard>
    </div>
  );
};
