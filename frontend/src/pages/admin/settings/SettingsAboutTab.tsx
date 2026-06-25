import { InputField, TextareaField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { useI18n } from '@/lib/i18n';

interface AboutState {
  aboutSectionTitle: string;
  bio: string;
  phone: string;
  contactEmail: string;
  instagramHandle: string;
  facebookUrl: string;
  tiktokUrl: string;
}

interface SettingsAboutTabProps {
  about: AboutState;
  setAbout: React.Dispatch<React.SetStateAction<AboutState>>;
  profilePreview: string;
  uploadingProfile: boolean;
  profileInputRef: React.RefObject<HTMLInputElement>;
  onProfileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  savingAbout: boolean;
  onSaveAbout: () => void;
}

export const SettingsAboutTab = ({
  about,
  setAbout,
  profilePreview,
  uploadingProfile,
  profileInputRef,
  onProfileUpload,
  savingAbout,
  onSaveAbout,
}: SettingsAboutTabProps) => {
  const { t } = useI18n();

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
          <input ref={profileInputRef} type='file' accept='image/*' className='hidden' onChange={onProfileUpload} />
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

        <Button type='button' variant='primary' onClick={onSaveAbout} disabled={savingAbout}>
          {savingAbout ? t('admin.common.saving') : t('admin.settings.save_about')}
        </Button>
      </div>
    </div>
  );
};
