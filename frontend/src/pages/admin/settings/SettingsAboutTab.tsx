import { useRef, useState, useEffect } from 'react';
import { InputField, TextareaField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { useI18n } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings, queryKeys } from '@/hooks/useQueries';
import api, { getImageUrl } from '@/lib/api';
import { toast } from 'sonner';

interface AboutState {
  aboutSectionTitle: string;
  bio: string;
  phone: string;
  contactEmail: string;
  instagramHandle: string;
  facebookUrl: string;
  tiktokUrl: string;
}

export const SettingsAboutTab = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: settingsData } = useSettings();

  const [about, setAbout] = useState<AboutState>({
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

  // Seed from query cache
  useEffect(() => {
    if (!settingsData) return;
    const s = settingsData;
    setAbout({
      aboutSectionTitle: (s.aboutSectionTitle as string) || '',
      bio: (s.bio as string) || '',
      phone: (s.phone as string) || '',
      contactEmail: (s.contactEmail as string) || '',
      instagramHandle: (s.instagramHandle as string) || '',
      facebookUrl: (s.facebookUrl as string) || '',
      tiktokUrl: (s.tiktokUrl as string) || '',
    });
    if (s.profileImagePath) setProfilePreview(getImageUrl(s.profileImagePath as string));
  }, [settingsData]);

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

  return (
    <div className='max-w-2xl space-y-6'>
      <div className='bg-card rounded-xl border border-beige p-6 space-y-6'>
        <h2 className='font-semibold text-charcoal'>{t('admin.settings.tab.about')}</h2>

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

        <div>
          <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.about_section_title')}</label>
          <InputField
            type='text'
            value={about.aboutSectionTitle}
            onChange={(e) => setAbout({ ...about, aboutSectionTitle: e.target.value })}
            placeholder='About Me / קצת עליי'
          />
        </div>

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
  );
};
