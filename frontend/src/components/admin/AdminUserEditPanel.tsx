import { useState, useRef, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import api, { getImageUrl } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/api';
import { InputField, TextareaField, SelectField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { StorageBar } from '@/components/admin/StorageBar';
import { QuotaSlider } from '@/components/admin/QuotaSlider';
import { useAdminStorage, useSetAdminQuota, queryKeys } from '@/hooks/useQueries';
import type { AdminRecord, AdminSettings } from '@/types/admin';

interface ProfileForm {
  name: string; email: string; studioName: string; username: string;
  role: 'admin' | 'superadmin'; newPassword: string;
}
interface LandingForm {
  heroSubtitle: string; bio: string; phone: string;
  contactEmail: string; instagramHandle: string; facebookUrl: string;
}

const labelClass = 'block text-xs text-warm-gray mb-1';

interface Props {
  admin: AdminRecord;
  onClose: () => void;
}

export const AdminUserEditPanel = ({ admin, onClose }: Props) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const setAdminQuotaMutation = useSetAdminQuota();
  const { data: storage } = useAdminStorage(admin.id);

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: admin.name, email: admin.email, studioName: admin.studioName || '',
    username: admin.username || '', role: admin.role, newPassword: '',
  });
  const [landingForm, setLandingForm] = useState<LandingForm>({
    heroSubtitle: '', bio: '', phone: '', contactEmail: '', instagramHandle: '', facebookUrl: '',
  });
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLanding, setSavingLanding] = useState(false);
  const [editMsg, setEditMsg] = useState({ text: '', error: false });
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [quotaInputGB, setQuotaInputGB] = useState<number | null>(
    admin.storageQuotaBytes ? parseFloat((admin.storageQuotaBytes / 1024 ** 3).toFixed(1)) : 10
  );
  const [disconnectingSSO, setDisconnectingSSO] = useState(false);
  const [togglingSSO, setTogglingSSO] = useState(false);
  const [canOrderSupplier, setCanOrderSupplier] = useState(admin.canOrderSupplier ?? true);
  const [clientsCanOrder, setClientsCanOrder] = useState(admin.clientsCanOrder ?? true);
  const [savingPerms, setSavingPerms] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/admins/${admin.id}/settings`).then((r) => {
      const s: AdminSettings = r.data;
      setSettings(s);
      setLandingForm({
        heroSubtitle: s.heroSubtitle, bio: s.bio, phone: s.phone,
        contactEmail: s.contactEmail, instagramHandle: s.instagramHandle, facebookUrl: s.facebookUrl,
      });
    }).catch(() => {});
  }, [admin.id]);

  const flash = (text: string, error = false) => {
    setEditMsg({ text, error });
    setTimeout(() => setEditMsg({ text: '', error: false }), 3000);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setEditMsg({ text: '', error: false });
    try {
      const payload: Record<string, string> = {
        name: profileForm.name, email: profileForm.email,
        studioName: profileForm.studioName, username: profileForm.username, role: profileForm.role,
      };
      if (profileForm.newPassword) payload.password = profileForm.newPassword;
      await api.patch(`/admins/${admin.id}`, payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.admins });
      setProfileForm((f) => ({ ...f, newPassword: '' }));
      flash(t('admin.users.profile_saved'));
    } catch (err: any) {
      flash(err.response?.data?.message || t('admin.users.save_error'), true);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveLanding = async () => {
    setSavingLanding(true);
    setEditMsg({ text: '', error: false });
    try {
      await api.put(`/admins/${admin.id}/landing`, landingForm);
      flash(t('admin.users.landing_saved'));
    } catch (err: any) {
      flash(err.response?.data?.message || t('admin.users.save_error'), true);
    } finally {
      setSavingLanding(false);
    }
  };

  const handleImageUpload = async (type: 'hero-image' | 'profile-image', file: File) => {
    const setter = type === 'hero-image' ? setUploadingHero : setUploadingProfile;
    setter(true);
    setEditMsg({ text: '', error: false });
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post(`/admins/${admin.id}/${type}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSettings((prev) => prev ? {
        ...prev,
        ...(type === 'hero-image' ? { heroImagePath: r.data.heroImagePath } : { profileImagePath: r.data.profileImagePath }),
      } : prev);
      flash(t('admin.users.image_uploaded'));
    } catch (err: any) {
      flash(err.response?.data?.message || t('admin.users.upload_error'), true);
    } finally {
      setter(false);
    }
  };

  const handleSavePerms = async (next: { canOrderSupplier?: boolean; clientsCanOrder?: boolean }) => {
    // optimistic local toggle already applied by caller; persist + refetch
    setSavingPerms(true);
    try {
      await api.patch(`/admins/${admin.id}`, next);
      queryClient.invalidateQueries({ queryKey: queryKeys.admins });
    } catch {
      toast.error(t('admin.users.save_error'));
    } finally {
      setSavingPerms(false);
    }
  };

  const handleConnectGoogle = () => {
    window.location.href = `${API_BASE}/api/admins/${admin.id}/sso-link`;
  };

  const handleDisconnectSSO = async () => {
    setDisconnectingSSO(true);
    try {
      await api.delete(`/admins/${admin.id}/sso-link`);
      queryClient.invalidateQueries({ queryKey: queryKeys.admins });
      toast.success(t('admin.settings.sso.unlink_success'));
    } catch {
      toast.error(t('admin.settings.sso.toggle_failed'));
    } finally {
      setDisconnectingSSO(false);
    }
  };

  const handleToggleSSO = async () => {
    setTogglingSSO(true);
    try {
      await api.patch(`/admins/${admin.id}/sso`);
      queryClient.invalidateQueries({ queryKey: queryKeys.admins });
    } catch {
      toast.error(t('admin.settings.sso.toggle_failed'));
    } finally {
      setTogglingSSO(false);
    }
  };

  return (
    <div className='border border-beige bg-ivory rounded-xl p-6 space-y-6 mt-1'>
      <div className='flex items-center justify-between'>
        <h3 className='text-charcoal text-sm'>{t('admin.users.edit')} {admin.name}</h3>
        <button onClick={onClose} className='w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-charcoal hover:bg-beige transition-colors'>
          <X size={15} />
        </button>
      </div>

      {editMsg.text && (
        <p className={`text-xs flex items-center gap-1.5 ${editMsg.error ? 'text-red-500' : 'text-charcoal'}`}>
          {!editMsg.error && <Check size={13} />}
          {editMsg.text}
        </p>
      )}

      {/* Profile */}
      <div className='space-y-3'>
        <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>{t('admin.users.section_profile')}</h4>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <div>
            <label className={labelClass}>{t('admin.common.name')}</label>
            <InputField type='text' value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.common.email')}</label>
            <InputField type='email' value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.users.username_url')}</label>
            <InputField type='text' value={profileForm.username}
              onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              className='font-mono' placeholder={t('admin.users.username_ph')} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.settings.studio_name')}</label>
            <InputField type='text' value={profileForm.studioName} onChange={(e) => setProfileForm((f) => ({ ...f, studioName: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.users.role')}</label>
            <SelectField value={profileForm.role} onChange={(e) => setProfileForm((f) => ({ ...f, role: e.target.value as 'admin' | 'superadmin' }))}>
              <option value='admin'>{t('admin.users.admin_label')}</option>
              <option value='superadmin'>{t('admin.users.superadmin_label')}</option>
            </SelectField>
          </div>
          <div>
            <label className={labelClass}>{t('admin.users.new_password')}</label>
            <InputField type='password' value={profileForm.newPassword}
              onChange={(e) => setProfileForm((f) => ({ ...f, newPassword: e.target.value }))}
              placeholder={t('admin.users.password_unchanged')} />
            <p className='text-[10px] text-warm-gray mt-0.5'>{t('admin.users.password_hint_full')}</p>
          </div>
        </div>
        <Button variant='primary' size='sm' onClick={handleSaveProfile} disabled={savingProfile}>
          <Check size={13} />
          {savingProfile ? t('admin.common.saving') : t('admin.users.save_profile')}
        </Button>
      </div>

      <div className='border-t border-beige' />

      {/* Supplier ordering permissions */}
      <div className='space-y-3'>
        <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>{t('admin.nav.store')}</h4>
        <label className='flex items-center gap-2 cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={canOrderSupplier}
            disabled={savingPerms}
            onChange={(e) => { setCanOrderSupplier(e.target.checked); handleSavePerms({ canOrderSupplier: e.target.checked }); }}
            className='accent-blush w-3.5 h-3.5'
          />
          <span className='text-xs text-charcoal'>{t('admin.users.can_order_supplier')}</span>
        </label>
        <label className='flex items-center gap-2 cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={clientsCanOrder}
            disabled={savingPerms}
            onChange={(e) => { setClientsCanOrder(e.target.checked); handleSavePerms({ clientsCanOrder: e.target.checked }); }}
            className='accent-blush w-3.5 h-3.5'
          />
          <span className='text-xs text-charcoal'>{t('admin.users.clients_can_order')}</span>
        </label>
      </div>

      <div className='border-t border-beige' />

      {/* Landing */}
      <div className='space-y-3'>
        <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>{t('admin.users.section_landing')}</h4>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <div className='sm:col-span-2'>
            <label className={labelClass}>{t('admin.users.landing_hero_subtitle')}</label>
            <InputField type='text' value={landingForm.heroSubtitle} onChange={(e) => setLandingForm((f) => ({ ...f, heroSubtitle: e.target.value }))} />
          </div>
          <div className='sm:col-span-2'>
            <label className={labelClass}>{t('admin.users.landing_bio')}</label>
            <TextareaField value={landingForm.bio} onChange={(e) => setLandingForm((f) => ({ ...f, bio: e.target.value }))} rows={3} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.users.landing_phone')}</label>
            <InputField type='tel' value={landingForm.phone} onChange={(e) => setLandingForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.users.landing_contact_email')}</label>
            <InputField type='email' value={landingForm.contactEmail} onChange={(e) => setLandingForm((f) => ({ ...f, contactEmail: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.settings.instagram')}</label>
            <InputField type='text' value={landingForm.instagramHandle}
              onChange={(e) => setLandingForm((f) => ({ ...f, instagramHandle: e.target.value }))}
              placeholder={t('admin.users.instagram_ph')} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.settings.facebook')}</label>
            <InputField type='url' value={landingForm.facebookUrl}
              onChange={(e) => setLandingForm((f) => ({ ...f, facebookUrl: e.target.value }))}
              placeholder={t('admin.users.facebook_ph')} />
          </div>
        </div>
        <Button variant='primary' size='sm' onClick={handleSaveLanding} disabled={savingLanding}>
          <Check size={13} />
          {savingLanding ? t('admin.common.saving') : t('admin.users.save_landing')}
        </Button>
      </div>

      <div className='border-t border-beige' />

      {/* Storage */}
      <div className='space-y-3'>
        <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>{t('admin.users.storage_section')}</h4>
        {storage && (
          <StorageBar usedGB={storage.usedGB} quotaGB={storage.quotaGB} percentUsed={storage.percentUsed} unlimited={storage.unlimited} />
        )}
        <QuotaSlider value={quotaInputGB} onChange={setQuotaInputGB} />
        <Button variant='primary' size='sm' disabled={setAdminQuotaMutation.isPending}
          onClick={() => setAdminQuotaMutation.mutate(
            { adminId: admin.id, quotaGB: quotaInputGB ?? 0 },
            {
              onSuccess: () => flash(t('admin.users.quota_saved')),
              onError: (err: any) => flash(err.response?.data?.message || t('admin.users.save_error'), true),
            },
          )}>
          <Check size={13} />
          {setAdminQuotaMutation.isPending ? t('admin.common.saving') : t('admin.showcase.save')}
        </Button>
      </div>

      <div className='border-t border-beige' />

      {/* SSO */}
      <div className='space-y-3'>
        <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>{t('admin.settings.sso.title')}</h4>
        <div className='flex items-center gap-2'>
          {admin.googleEmail ? (
            <span className='text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200'>
              {t('admin.settings.sso.connected')} — <span className='font-mono'>{admin.googleEmail}</span>
            </span>
          ) : (
            <span className='text-xs text-warm-gray'>{t('admin.settings.sso.not_connected')}</span>
          )}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {admin.googleEmail ? (
            <Button variant='ghost' size='sm' onClick={handleDisconnectSSO} disabled={disconnectingSSO}>
              {disconnectingSSO ? t('admin.settings.sso.disconnecting') : t('admin.settings.sso.disconnect')}
            </Button>
          ) : (
            <Button variant='ghost' size='sm' onClick={handleConnectGoogle}>
              <svg width='14' height='14' viewBox='0 0 24 24' aria-hidden='true' className='shrink-0'>
                <path d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' fill='#4285F4' />
                <path d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' fill='#34A853' />
                <path d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z' fill='#FBBC05' />
                <path d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' fill='#EA4335' />
              </svg>
              {t('admin.settings.sso.connect')}
            </Button>
          )}
          {admin.googleEmail && (
            <label className='flex items-center gap-2 cursor-pointer select-none'>
              <input type='checkbox' checked={admin.ssoEnabled ?? false} disabled={togglingSSO}
                onChange={handleToggleSSO} className='accent-blush w-3.5 h-3.5' />
              <span className='text-xs text-charcoal'>{t('admin.settings.sso.enabled_label')}</span>
            </label>
          )}
        </div>
      </div>

      <div className='border-t border-beige' />

      {/* Images */}
      <div className='space-y-3'>
        <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>{t('admin.users.section_images')}</h4>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <p className='text-xs text-warm-gray'>{t('admin.users.hero_image_label')}</p>
            {settings?.heroImagePath && (
              <img src={getImageUrl(settings.heroImagePath)} alt='Hero' className='w-full h-24 object-cover rounded-lg border border-beige' />
            )}
            <input ref={heroFileRef} type='file' accept='image/*' className='hidden'
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload('hero-image', f); e.target.value = ''; }} />
            <Button variant='ghost' size='sm' className='w-full' onClick={() => heroFileRef.current?.click()} disabled={uploadingHero}>
              {uploadingHero ? t('admin.common.uploading') : settings?.heroImagePath ? t('admin.users.replace_image') : t('admin.users.upload_image')}
            </Button>
          </div>
          <div className='space-y-2'>
            <p className='text-xs text-warm-gray'>{t('admin.users.profile_image_label')}</p>
            {settings?.profileImagePath && (
              <img src={getImageUrl(settings.profileImagePath)} alt='Profile' className='w-24 h-24 object-cover rounded-full border border-beige mx-auto' />
            )}
            <input ref={profileFileRef} type='file' accept='image/*' className='hidden'
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload('profile-image', f); e.target.value = ''; }} />
            <Button variant='ghost' size='sm' className='w-full' onClick={() => profileFileRef.current?.click()} disabled={uploadingProfile}>
              {uploadingProfile ? t('admin.common.uploading') : settings?.profileImagePath ? t('admin.users.replace_image') : t('admin.users.upload_image')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
