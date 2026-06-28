import { useRef, useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { InputField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { useI18n } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings, queryKeys } from '@/hooks/useQueries';
import api, { getImageUrl } from '@/lib/api';
import { toast } from 'sonner';
import type { HeroOverlayOpacity } from './settingsComponents';

interface HeroState {
  heroSubtitle: string;
  heroOverlayOpacity: HeroOverlayOpacity;
  heroCtaPrimaryLabel: string;
  heroCtaSecondaryLabel: string;
}

interface FinalCtaState {
  heading: string;
  subtext: string;
  buttonLabel: string;
}

export const SettingsHeroTab = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: settingsData } = useSettings();

  const [hero, setHero] = useState<HeroState>({
    heroSubtitle: '',
    heroOverlayOpacity: 'medium',
    heroCtaPrimaryLabel: '',
    heroCtaSecondaryLabel: '',
  });
  const [heroTagline, setHeroTagline] = useState('');
  const [heroPreview, setHeroPreview] = useState('');
  const [savingHero, setSavingHero] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const [finalCta, setFinalCta] = useState<FinalCtaState>({ heading: '', subtext: '', buttonLabel: '' });
  const [savingFinalCta, setSavingFinalCta] = useState(false);

  // Seed from query cache
  useEffect(() => {
    if (!settingsData) return;
    const s = settingsData;
    setHero({
      heroSubtitle: (s.heroSubtitle as string) || '',
      heroOverlayOpacity: (s.heroOverlayOpacity as HeroOverlayOpacity) || 'medium',
      heroCtaPrimaryLabel: (s.heroCtaPrimaryLabel as string) || '',
      heroCtaSecondaryLabel: (s.heroCtaSecondaryLabel as string) || '',
    });
    setHeroTagline((s.heroTagline as string) || '');
    if (s.heroImagePath) setHeroPreview(getImageUrl(s.heroImagePath as string));
    setFinalCta({
      heading: (s.finalCtaHeading as string) || '',
      subtext: (s.finalCtaSubtext as string) || '',
      buttonLabel: (s.finalCtaButtonLabel as string) || '',
    });
  }, [settingsData]);

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
      await api.put('/settings/landing', {
        finalCtaHeading: finalCta.heading,
        finalCtaSubtext: finalCta.subtext,
        finalCtaButtonLabel: finalCta.buttonLabel,
      });
      toast.success(t('admin.settings.landing_saved'));
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    } catch {
      toast.error(t('admin.settings.landing_failed'));
    } finally {
      setSavingFinalCta(false);
    }
  };

  return (
    <div className='max-w-2xl space-y-6'>
      <div className='bg-card rounded-xl border border-beige p-6 space-y-6'>
        <h2 className='font-semibold text-charcoal'>{t('admin.settings.tab.hero')}</h2>

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

        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.hero_tagline_label')}</label>
          <InputField
            type='text'
            value={heroTagline}
            onChange={(e) => setHeroTagline(e.target.value)}
            placeholder='צלם מקצועי · אירועים ומשפחות'
          />
        </div>

        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.hero_subtitle')}</label>
          <InputField
            type='text'
            value={hero.heroSubtitle}
            onChange={(e) => setHero({ ...hero, heroSubtitle: e.target.value })}
            placeholder='צילומי משפחה, הריון וניו בורן בצפון הארץ'
          />
        </div>

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

      <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
        <h2 className='font-semibold text-charcoal'>{t('admin.settings.final_cta_section')}</h2>
        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.final_cta_heading')}</label>
          <InputField type='text' value={finalCta.heading} onChange={(e) => setFinalCta({ ...finalCta, heading: e.target.value })} placeholder='מוכנים לצלם? / Ready to Shoot?' />
        </div>
        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.final_cta_subtext')}</label>
          <InputField type='text' value={finalCta.subtext} onChange={(e) => setFinalCta({ ...finalCta, subtext: e.target.value })} placeholder='צרו קשר היום...' />
        </div>
        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.final_cta_button_label')}</label>
          <InputField type='text' value={finalCta.buttonLabel} onChange={(e) => setFinalCta({ ...finalCta, buttonLabel: e.target.value })} placeholder='שלח הודעה / Send a Message' />
        </div>
        <Button type='button' variant='primary' onClick={handleSaveFinalCta} disabled={savingFinalCta}>
          {savingFinalCta ? t('admin.common.saving') : t('admin.settings.save_hero')}
        </Button>
      </div>
    </div>
  );
};
