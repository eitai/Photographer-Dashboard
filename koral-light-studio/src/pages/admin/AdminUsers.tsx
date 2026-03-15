import { useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { Trash2, Plus, Shield, User, Pencil, ExternalLink, X, Check } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface AdminRecord {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'superadmin';
  username?: string | null;
  studioName?: string | null;
  createdAt: string;
}

interface AdminSettings {
  bio: string;
  heroImagePath: string;
  profileImagePath: string;
  phone: string;
  instagramHandle: string;
  facebookUrl: string;
  heroSubtitle: string;
  contactEmail: string;
}

interface ProfileForm {
  name: string;
  email: string;
  studioName: string;
  username: string;
}

interface LandingForm {
  heroSubtitle: string;
  bio: string;
  phone: string;
  contactEmail: string;
  instagramHandle: string;
  facebookUrl: string;
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'admin' as const, username: '', studioName: '' };

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50';
const labelClass = 'block text-xs text-warm-gray mb-1';

export const AdminUsers = () => {
  const { admin: me } = useAuth();
  const { t } = useI18n();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit panel state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({ name: '', email: '', studioName: '', username: '' });
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
    api
      .get('/admins')
      .then((r) => setAdmins(r.data))
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setCreating(true);
    try {
      const r = await api.post('/admins', form);
      setAdmins((prev) => [...prev, r.data]);
      setForm(EMPTY_FORM);
      setMsg({ text: t('admin.users.created'), error: false });
      setTimeout(() => setMsg({ text: '', error: false }), 3000);
    } catch (err: any) {
      setMsg({ text: err.response?.data?.message || t('admin.users.create_error'), error: true });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.users.delete_confirm'))) return;
    setDeletingId(id);
    try {
      await api.delete(`/admins/${id}`);
      setAdmins((prev) => prev.filter((a) => a._id !== id));
      if (editingId === id) setEditingId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || t('admin.users.delete_error'));
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = async (a: AdminRecord) => {
    if (editingId === a._id) {
      setEditingId(null);
      return;
    }
    setEditingId(a._id);
    setEditMsg({ text: '', error: false });
    setProfileForm({ name: a.name, email: a.email, studioName: a.studioName || '', username: a.username || '' });
    setSettings(null);
    try {
      const r = await api.get(`/admins/${a._id}/settings`);
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
      const r = await api.patch(`/admins/${editingId}`, profileForm);
      setAdmins((prev) => prev.map((a) => (a._id === editingId ? { ...a, ...r.data } : a)));
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

  const editingAdmin = admins.find((a) => a._id === editingId);

  return (
    <AdminLayout title={t('admin.users.title')}>
      <div className='max-w-3xl space-y-6'>
        {/* Existing admins */}
        <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
          <h2 className=' text-charcoal'>{t('admin.users.existing')}</h2>
          <div className='space-y-2'>
            {admins.map((a) => (
              <div key={a._id} className='space-y-0'>
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
                        {a._id === me?.id && (
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
                      href={`/${a._id}`}
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
                        editingId === a._id ? 'bg-blush text-charcoal' : 'text-warm-gray hover:text-charcoal hover:bg-beige'
                      }`}
                      title={t('admin.users.edit')}
                    >
                      <Pencil size={14} />
                    </button>
                    {a._id !== me?.id && (
                      <button
                        onClick={() => handleDelete(a._id)}
                        disabled={deletingId === a._id}
                        className='w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40'
                        title={t('admin.clients.delete_btn')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit panel — inline below the row */}
                {editingId === a._id && editingAdmin && (
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
                          <input
                            type='text'
                            value={profileForm.name}
                            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.common.email')}</label>
                          <input
                            type='email'
                            value={profileForm.email}
                            onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.users.username_url')}</label>
                          <input
                            type='text'
                            value={profileForm.username}
                            onChange={(e) =>
                              setProfileForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))
                            }
                            className={`${inputClass} font-mono`}
                            placeholder='user123'
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t('admin.settings.studio_name')}</label>
                          <input
                            type='text'
                            value={profileForm.studioName}
                            onChange={(e) => setProfileForm((f) => ({ ...f, studioName: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className='flex items-center gap-1.5 bg-blush text-charcoal px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
                      >
                        <Check size={13} />
                        {savingProfile ? t('admin.common.saving') : t('admin.users.save_profile')}
                      </button>
                    </div>

                    <div className='border-t border-beige' />

                    {/* Landing page section */}
                    <div className='space-y-3'>
                      <h4 className='text-xs font-semibold text-warm-gray uppercase tracking-wide'>
                        {t('admin.users.section_landing')}
                      </h4>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        <div className='sm:col-span-2'>
                          <label className={labelClass}>כותרת משנה (hero)</label>
                          <input
                            type='text'
                            value={landingForm.heroSubtitle}
                            onChange={(e) => setLandingForm((f) => ({ ...f, heroSubtitle: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div className='sm:col-span-2'>
                          <label className={labelClass}>ביו</label>
                          <textarea
                            value={landingForm.bio}
                            onChange={(e) => setLandingForm((f) => ({ ...f, bio: e.target.value }))}
                            rows={3}
                            className={`${inputClass} resize-none`}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>טלפון</label>
                          <input
                            type='tel'
                            value={landingForm.phone}
                            onChange={(e) => setLandingForm((f) => ({ ...f, phone: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>אימייל ליצירת קשר</label>
                          <input
                            type='email'
                            value={landingForm.contactEmail}
                            onChange={(e) => setLandingForm((f) => ({ ...f, contactEmail: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Instagram</label>
                          <input
                            type='text'
                            value={landingForm.instagramHandle}
                            onChange={(e) => setLandingForm((f) => ({ ...f, instagramHandle: e.target.value }))}
                            className={inputClass}
                            placeholder='@username'
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Facebook URL</label>
                          <input
                            type='url'
                            value={landingForm.facebookUrl}
                            onChange={(e) => setLandingForm((f) => ({ ...f, facebookUrl: e.target.value }))}
                            className={inputClass}
                            placeholder='https://facebook.com/...'
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleSaveLanding}
                        disabled={savingLanding}
                        className='flex items-center gap-1.5 bg-blush text-charcoal px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
                      >
                        <Check size={13} />
                        {savingLanding ? t('admin.common.saving') : t('admin.users.save_landing')}
                      </button>
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
                              src={`${API_BASE}${settings.heroImagePath}`}
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
                          <button
                            onClick={() => heroFileRef.current?.click()}
                            disabled={uploadingHero}
                            className='w-full px-3 py-1.5 rounded-lg border border-beige text-xs text-warm-gray hover:bg-beige/50 transition-colors disabled:opacity-60'
                          >
                            {uploadingHero
                              ? t('admin.common.uploading')
                              : settings?.heroImagePath
                                ? t('admin.users.replace_image')
                                : t('admin.users.upload_image')}
                          </button>
                        </div>

                        {/* Profile image */}
                        <div className='space-y-2'>
                          <p className='text-xs text-warm-gray'>{t('admin.users.profile_image_label')}</p>
                          {settings?.profileImagePath && (
                            <img
                              src={`${API_BASE}${settings.profileImagePath}`}
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
                          <button
                            onClick={() => profileFileRef.current?.click()}
                            disabled={uploadingProfile}
                            className='w-full px-3 py-1.5 rounded-lg border border-beige text-xs text-warm-gray hover:bg-beige/50 transition-colors disabled:opacity-60'
                          >
                            {uploadingProfile
                              ? t('admin.common.uploading')
                              : settings?.profileImagePath
                                ? t('admin.users.replace_image')
                                : t('admin.users.upload_image')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {admins.length === 0 && <p className='text-sm text-warm-gray text-center py-4'>{t('admin.users.no_users')}</p>}
          </div>
        </div>

        {/* Create new admin */}
        <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
          <h2 className=' text-charcoal'>{t('admin.users.add_new')}</h2>
          <form onSubmit={handleCreate} className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className={labelClass}>{t('admin.common.name')}</label>
                <input
                  type='text'
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder='שם מלא'
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.common.email')}</label>
                <input
                  type='email'
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  placeholder='email@example.com'
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.users.password')}</label>
                <input
                  type='password'
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  placeholder={t('admin.users.password_hint')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.users.role')}</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'superadmin' }))}
                  className={inputClass}
                >
                  <option value='admin'>{t('admin.users.admin_label')}</option>
                  <option value='superadmin'>{t('admin.users.superadmin_label')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('admin.users.username_url')}</label>
                <input
                  type='text'
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder='user123'
                  className={`${inputClass} font-mono`}
                />
                <p className='text-[10px] text-warm-gray mt-0.5'>{t('admin.users.username_hint')}</p>
              </div>
              <div>
                <label className={labelClass}>{t('admin.settings.studio_name')}</label>
                <input
                  type='text'
                  value={form.studioName}
                  onChange={(e) => setForm((f) => ({ ...f, studioName: e.target.value }))}
                  placeholder='Studio Name'
                  className={inputClass}
                />
              </div>
            </div>

            {msg.text && <p className={`text-sm ${msg.error ? 'text-red-500' : 'text-charcoal'}`}>{msg.text}</p>}

            <button
              type='submit'
              disabled={creating}
              className='flex items-center gap-2 bg-blush text-charcoal px-5 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              <Plus size={15} />
              {creating ? t('admin.users.creating') : t('admin.users.create')}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
};
