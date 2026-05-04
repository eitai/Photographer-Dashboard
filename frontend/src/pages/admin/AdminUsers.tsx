import { useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import api, { getImageUrl } from '@/lib/api';
import { toast } from 'sonner';
import { Trash2, Plus, Shield, User, Pencil, ExternalLink, X, Check, Search } from 'lucide-react';
import type { AdminRecord, AdminSettings } from '@/types/admin';
import { InputField, TextareaField, SelectField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/ui/Modal';
import { useAdmins, useCreateAdmin, useDeleteAdmin, useAdminStorage, useSetAdminQuota, queryKeys } from '@/hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { StorageBar } from '@/components/admin/StorageBar';
import { QuotaSlider } from '@/components/admin/QuotaSlider';

interface ProfileForm {
  name: string;
  email: string;
  studioName: string;
  username: string;
  role: 'admin' | 'superadmin';
  newPassword: string;
}

interface LandingForm {
  heroSubtitle: string;
  bio: string;
  phone: string;
  contactEmail: string;
  instagramHandle: string;
  facebookUrl: string;
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'admin' as const, username: '', studioName: '', quotaGB: 10 as number | null };

const labelClass = 'block text-xs text-warm-gray mb-1';

export const AdminUsers = () => {
  const { admin: me } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: admins = [], isError: adminsError } = useAdmins();
  const createAdminMutation = useCreateAdmin();
  const deleteAdminMutation = useDeleteAdmin();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Edit panel state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({ name: '', email: '', studioName: '', username: '', role: 'admin', newPassword: '' });
  const [landingForm, setLandingForm] = useState<LandingForm>({
    heroSubtitle: '',
    bio: '',
    phone: '',
    contactEmail: '',
    instagramHandle: '',
    facebookUrl: '',
  });
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLanding, setSavingLanding] = useState(false);
  const [editMsg, setEditMsg] = useState({ text: '', error: false });
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adminsError) toast.error(t('admin.users.load_failed'));
  }, [adminsError, t]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    createAdminMutation.mutate(form, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        toast.success(t('admin.users.created'));
      },
      onError: (err: unknown) => {
        const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        toast.error(message || t('admin.users.create_error'));
      },
    });
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(null);
    deleteAdminMutation.mutate(id, {
      onSuccess: () => {
        if (editingId === id) setEditingId(null);
      },
      onError: (err: unknown) => {
        const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        toast.error(message || t('admin.users.delete_error'));
      },
    });
  };

  const openEdit = async (a: AdminRecord) => {
    if (editingId === a.id) {
      setEditingId(null);
      return;
    }
    setEditingId(a.id);
    setEditMsg({ text: '', error: false });
    setProfileForm({ name: a.name, email: a.email, studioName: a.studioName || '', username: a.username || '', role: a.role, newPassword: '' });
    setQuotaInputGB(a.storageQuotaBytes ? parseFloat((a.storageQuotaBytes / 1024 ** 3).toFixed(1)) : 10);
    setSettings(null);
    try {
      const r = await api.get(`/admins/${a.id}/settings`);
      const s: AdminSettings = r.data;
      setSettings(s);
      setLandingForm({
        heroSubtitle: s.heroSubtitle,
        bio: s.bio,
        phone: s.phone,
        contactEmail: s.contactEmail,
        instagramHandle: s.instagramHandle,
        facebookUrl: s.facebookUrl,
      });
    } catch {
      setLandingForm({ heroSubtitle: '', bio: '', phone: '', contactEmail: '', instagramHandle: '', facebookUrl: '' });
    }
  };

  const handleSaveProfile = async () => {
    if (!editingId) return;
    setSavingProfile(true);
    setEditMsg({ text: '', error: false });
    try {
      const payload: Record<string, string> = {
        name: profileForm.name,
        email: profileForm.email,
        studioName: profileForm.studioName,
        username: profileForm.username,
        role: profileForm.role,
      };
      if (profileForm.newPassword) payload.password = profileForm.newPassword;
      const r = await api.patch(`/admins/${editingId}`, payload);
      queryClient.invalidateQueries({ queryKey: queryKeys.admins });
      setProfileForm((f) => ({ ...f, newPassword: '' }));
      setEditMsg({ text: t('admin.users.profile_saved'), error: false });
      setTimeout(() => setEditMsg({ text: '', error: false }), 3000);
    } catch (err: any) {
      setEditMsg({ text: err.response?.data?.message || t('admin.users.save_error'), error: true });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveLanding = async () => {
    if (!editingId) return;
    setSavingLanding(true);
    setEditMsg({ text: '', error: false });
    try {
      await api.put(`/admins/${editingId}/landing`, landingForm);
      setEditMsg({ text: t('admin.users.landing_saved'), error: false });
      setTimeout(() => setEditMsg({ text: '', error: false }), 3000);
    } catch (err: any) {
      setEditMsg({ text: err.response?.data?.message || t('admin.users.save_error'), error: true });
    } finally {
      setSavingLanding(false);
    }
  };

  const handleImageUpload = async (type: 'hero-image' | 'profile-image', file: File) => {
    if (!editingId) return;
    const setter = type === 'hero-image' ? setUploadingHero : setUploadingProfile;
    setter(true);
    setEditMsg({ text: '', error: false });
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post(`/admins/${editingId}/${type}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              ...(type === 'hero-image' ? { heroImagePath: r.data.heroImagePath } : { profileImagePath: r.data.profileImagePath }),
            }
          : prev,
      );
      setEditMsg({ text: t('admin.users.image_uploaded'), error: false });
      setTimeout(() => setEditMsg({ text: '', error: false }), 3000);
    } catch (err: any) {
      setEditMsg({ text: err.response?.data?.message || t('admin.users.upload_error'), error: true });
    } finally {
      setter(false);
    }
  };

  const [quotaInputGB, setQuotaInputGB] = useState<number | null>(10);
  const setAdminQuotaMutation = useSetAdminQuota();
  const { data: editingAdminStorage } = useAdminStorage(editingId ?? '');

  const creating = createAdminMutation.isPending;
  const deletingId = deleteAdminMutation.isPending ? deleteAdminMutation.variables ?? null : null;
  const editingAdmin = (admins as AdminRecord[]).find((a) => a.id === editingId);
  const visibleAdmins = search.trim()
    ? admins.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()))
    : admins;

  const searchBar = (
    <div className='relative flex-1 max-w-xs'>
      <Search size={14} className='absolute top-1/2 -translate-y-1/2 start-3 text-warm-gray pointer-events-none' />
      <InputField
        type='text'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('admin.users.search_placeholder')}
        className='ps-8'
      />
    </div>
  );

  return (
    <AdminLayout title={t('admin.users.title')} actions={searchBar}>
      <div className='max-w-3xl space-y-6'>
        {/* Existing admins */}
        <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
          <h2 className=' text-charcoal'>{t('admin.users.existing')}</h2>
          <div className='space-y-2'>
            {visibleAdmins.map((a) => (
              <div key={a.id} className='space-y-0'>
                <div className='flex items-center justify-between px-4 py-3 rounded-lg border border-beige bg-ivory'>
                  <div className='flex items-center gap-3'>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        a.role === 'superadmin' ? 'bg-amber-100 text-amber-600' : 'bg-blush/20 text-blush'
                      }`}
                    >
                      {a.role === 'superadmin' ? <Shield size={15} /> : <User size={15} />}
                    </div>
                    <div>
                      <p className='text-sm font-medium text-charcoal flex items-center gap-2'>
                        {a.name}
                        {a.id === me?.id && (
                          <span className='text-[10px] bg-blush/20 text-charcoal px-1.5 py-0.5 rounded-full'>
                            {t('admin.users.you')}
                          </span>
                        )}
                      </p>
                      <p className='text-xs text-warm-gray'>{a.email}</p>
                      {a.username && <p className='text-xs text-warm-gray font-mono'>/{a.username}</p>}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        a.role === 'superadmin' ? 'bg-amber-100 text-amber-700' : 'bg-beige text-warm-gray'
                      }`}
                    >
                      {a.role === 'superadmin' ? t('admin.users.superadmin_label') : t('admin.users.admin_label')}
                    </span>
                    <a
                      href={`/${a.id}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-blush hover:bg-blush/10 transition-colors'
                      title={t('admin.users.view_landing')}
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => openEdit(a)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        editingId === a.id ? 'bg-blush text-primary-foreground' : 'text-warm-gray hover:text-charcoal hover:bg-beige'
                      }`}
                      title={t('admin.users.edit')}
                    >
                      <Pencil size={14} />
                    </button>
                    {a.id !== me?.id && (
                      <button
                        onClick={() => setDeleteConfirmId(a.id)}
                        disabled={deletingId === a.id}
                        className='w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40'
                        title={t('admin.clients.delete_btn')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit panel — inline below the row */}
                {editingId === a.id && editingAdmin && (
                  <div className='border border-beige bg-ivory rounded-xl p-6 space-y-6 mt-1'>
                    {/* Panel header */}
                    <div className='flex items-center justify-between'>
                      <h3 className=' text-charcoal text-sm'>
                        {t('admin.users.edit')} {editingAdmin.name}
                      </h3>
                      <button
                        onClick={() => setEditingId(null)}
                        className='w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-charcoal hover:bg-beige transition-colors'
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {editMsg.text && (
                      <p className={`text-xs flex items-center gap-1.5 ${editMsg.error ? 'text-red-500' : 'text-charcoal'}`}>
                        {!editMsg.error && <Check size={13} />}
                        {editMsg.text}
                      </p>
                    )}

                    {/* Profile section */}
                    <div className='space-y-3'>
                      <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>
                        {t('admin.users.section_profile')}
                      </h4>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        <div>
                          <label className={labelClass}>{t('admin.common.name')}</label>
                          <InputField
                            type='text'
                            value={profileForm.name}
                            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.common.email')}</label>
                          <InputField
                            type='email'
                            value={profileForm.email}
                            onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.users.username_url')}</label>
                          <InputField
                            type='text'
                            value={profileForm.username}
                            onChange={(e) =>
                              setProfileForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))
                            }
                            className='font-mono'
                            placeholder='user123'
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.settings.studio_name')}</label>
                          <InputField
                            type='text'
                            value={profileForm.studioName}
                            onChange={(e) => setProfileForm((f) => ({ ...f, studioName: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.users.role')}</label>
                          <SelectField
                            value={profileForm.role}
                            onChange={(e) => setProfileForm((f) => ({ ...f, role: e.target.value as 'admin' | 'superadmin' }))}
                          >
                            <option value='admin'>{t('admin.users.admin_label')}</option>
                            <option value='superadmin'>{t('admin.users.superadmin_label')}</option>
                          </SelectField>
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.users.new_password')}</label>
                          <InputField
                            type='password'
                            value={profileForm.newPassword}
                            onChange={(e) => setProfileForm((f) => ({ ...f, newPassword: e.target.value }))}
                            placeholder={t('admin.users.password_unchanged')}
                          />
                          <p className='text-[10px] text-warm-gray mt-0.5'>{t('admin.users.password_hint_full')}</p>
                        </div>
                      </div>
                      <Button
                        variant='primary'
                        size='sm'
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                      >
                        <Check size={13} />
                        {savingProfile ? t('admin.common.saving') : t('admin.users.save_profile')}
                      </Button>
                    </div>

                    <div className='border-t border-beige' />

                    {/* Landing page section */}
                    <div className='space-y-3'>
                      <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>
                        {t('admin.users.section_landing')}
                      </h4>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        <div className='sm:col-span-2'>
                          <label className={labelClass}>{t('admin.users.landing_hero_subtitle')}</label>
                          <InputField
                            type='text'
                            value={landingForm.heroSubtitle}
                            onChange={(e) => setLandingForm((f) => ({ ...f, heroSubtitle: e.target.value }))}
                          />
                        </div>
                        <div className='sm:col-span-2'>
                          <label className={labelClass}>{t('admin.users.landing_bio')}</label>
                          <TextareaField
                            value={landingForm.bio}
                            onChange={(e) => setLandingForm((f) => ({ ...f, bio: e.target.value }))}
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.users.landing_phone')}</label>
                          <InputField
                            type='tel'
                            value={landingForm.phone}
                            onChange={(e) => setLandingForm((f) => ({ ...f, phone: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.users.landing_contact_email')}</label>
                          <InputField
                            type='email'
                            value={landingForm.contactEmail}
                            onChange={(e) => setLandingForm((f) => ({ ...f, contactEmail: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Instagram</label>
                          <InputField
                            type='text'
                            value={landingForm.instagramHandle}
                            onChange={(e) => setLandingForm((f) => ({ ...f, instagramHandle: e.target.value }))}
                            placeholder='@username'
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Facebook URL</label>
                          <InputField
                            type='url'
                            value={landingForm.facebookUrl}
                            onChange={(e) => setLandingForm((f) => ({ ...f, facebookUrl: e.target.value }))}
                            placeholder='https://facebook.com/...'
                          />
                        </div>
                      </div>
                      <Button
                        variant='primary'
                        size='sm'
                        onClick={handleSaveLanding}
                        disabled={savingLanding}
                      >
                        <Check size={13} />
                        {savingLanding ? t('admin.common.saving') : t('admin.users.save_landing')}
                      </Button>
                    </div>

                    <div className='border-t border-beige' />

                    {/* Storage Quota section */}
                    <div className='space-y-3'>
                      <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>
                        {t('admin.users.storage_section')}
                      </h4>
                      {editingAdminStorage && (
                        <StorageBar
                          usedGB={editingAdminStorage.usedGB}
                          quotaGB={editingAdminStorage.quotaGB}
                          percentUsed={editingAdminStorage.percentUsed}
                          unlimited={editingAdminStorage.unlimited}
                        />
                      )}
                      <QuotaSlider value={quotaInputGB} onChange={setQuotaInputGB} />
                      <Button
                        variant='primary'
                        size='sm'
                        disabled={setAdminQuotaMutation.isPending}
                        onClick={() => {
                          if (!editingId) return;
                          setAdminQuotaMutation.mutate(
                            { adminId: editingId, quotaGB: quotaInputGB ?? 0 },
                            {
                              onSuccess: () => {
                                setEditMsg({ text: t('admin.users.quota_saved'), error: false });
                                setTimeout(() => setEditMsg({ text: '', error: false }), 3000);
                              },
                              onError: (err: unknown) => {
                                const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
                                setEditMsg({ text: message || t('admin.users.save_error'), error: true });
                              },
                            },
                          );
                        }}
                      >
                        <Check size={13} />
                        {setAdminQuotaMutation.isPending ? t('admin.common.saving') : t('admin.showcase.save')}
                      </Button>
                    </div>

                    <div className='border-t border-beige' />

                    {/* Images section */}
                    <div className='space-y-3'>
                      <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>
                        {t('admin.users.section_images')}
                      </h4>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        {/* Hero image */}
                        <div className='space-y-2'>
                          <p className='text-xs text-warm-gray'>{t('admin.users.hero_image_label')}</p>
                          {settings?.heroImagePath && (
                            <img
                              src={getImageUrl(settings.heroImagePath)}
                              alt='Hero'
                              className='w-full h-24 object-cover rounded-lg border border-beige'
                            />
                          )}
                          <input
                            ref={heroFileRef}
                            type='file'
                            accept='image/*'
                            className='hidden'
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload('hero-image', file);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            variant='ghost'
                            size='sm'
                            className='w-full'
                            onClick={() => heroFileRef.current?.click()}
                            disabled={uploadingHero}
                          >
                            {uploadingHero
                              ? t('admin.common.uploading')
                              : settings?.heroImagePath
                                ? t('admin.users.replace_image')
                                : t('admin.users.upload_image')}
                          </Button>
                        </div>

                        {/* Profile image */}
                        <div className='space-y-2'>
                          <p className='text-xs text-warm-gray'>{t('admin.users.profile_image_label')}</p>
                          {settings?.profileImagePath && (
                            <img
                              src={getImageUrl(settings.profileImagePath)}
                              alt='Profile'
                              className='w-24 h-24 object-cover rounded-full border border-beige mx-auto'
                            />
                          )}
                          <input
                            ref={profileFileRef}
                            type='file'
                            accept='image/*'
                            className='hidden'
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload('profile-image', file);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            variant='ghost'
                            size='sm'
                            className='w-full'
                            onClick={() => profileFileRef.current?.click()}
                            disabled={uploadingProfile}
                          >
                            {uploadingProfile
                              ? t('admin.common.uploading')
                              : settings?.profileImagePath
                                ? t('admin.users.replace_image')
                                : t('admin.users.upload_image')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {visibleAdmins.length === 0 && <p className='text-sm text-warm-gray text-center py-4'>{t('admin.users.no_users')}</p>}
          </div>
        </div>

        {/* Create new admin */}
        <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
          <h2 className=' text-charcoal'>{t('admin.users.add_new')}</h2>
          <form onSubmit={handleCreate} className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className={labelClass}>{t('admin.common.name')}</label>
                <InputField
                  type='text'
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder={t('admin.common.full_name_ph')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.common.email')}</label>
                <InputField
                  type='email'
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  placeholder='email@example.com'
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.users.password')}</label>
                <InputField
                  type='password'
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  placeholder={t('admin.users.password_hint')}
                />
                <p className='text-[10px] text-warm-gray mt-0.5'>{t('admin.users.password_hint_full')}</p>
              </div>
              <div>
                <label className={labelClass}>{t('admin.users.role')}</label>
                <SelectField
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'superadmin' }))}
                >
                  <option value='admin'>{t('admin.users.admin_label')}</option>
                  <option value='superadmin'>{t('admin.users.superadmin_label')}</option>
                </SelectField>
              </div>
              <div>
                <label className={labelClass}>{t('admin.users.username_url')}</label>
                <InputField
                  type='text'
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder='user123'
                  className='font-mono'
                />
                <p className='text-[10px] text-warm-gray mt-0.5'>{t('admin.users.username_hint')}</p>
              </div>
              <div>
                <label className={labelClass}>{t('admin.settings.studio_name')}</label>
                <InputField
                  type='text'
                  value={form.studioName}
                  onChange={(e) => setForm((f) => ({ ...f, studioName: e.target.value }))}
                  placeholder='Studio Name'
                />
              </div>
              <div className='sm:col-span-2'>
                <QuotaSlider value={form.quotaGB} onChange={(v) => setForm((f) => ({ ...f, quotaGB: v }))} />
              </div>
            </div>


            <Button
              type='submit'
              variant='primary'
              disabled={creating}
            >
              <Plus size={15} />
              {creating ? t('admin.users.creating') : t('admin.users.create')}
            </Button>
          </form>
        </div>
      </div>

      {deleteConfirmId && (
        <Modal isOpen onClose={() => setDeleteConfirmId(null)}>
          <h3 className='text-lg text-charcoal mb-2'>{t('admin.users.delete_confirm')}</h3>
          <p className='text-sm text-warm-gray mb-6'>{t('admin.common.action_irreversible')}</p>
          <div className='flex gap-3'>
            <button
              onClick={() => handleDelete(deleteConfirmId)}
              disabled={!!deletingId}
              className='flex-1 bg-rose-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
            >
              {deletingId ? t('admin.common.deleting') : t('admin.common.delete')}
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              disabled={!!deletingId}
              className='flex-1 py-3 rounded-xl text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
