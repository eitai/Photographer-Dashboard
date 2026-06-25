import { useState } from 'react';
import { Star } from 'lucide-react';
import { InputField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { useI18n } from '@/lib/i18n';
import { useAdminSupplierProducts, useToggleSupplierFavorite } from '@/hooks/useQueries';
import api from '@/lib/api';
import type { AdminSupplierProduct } from '@/lib/api';
import { toast } from 'sonner';

interface Admin {
  id?: string;
  name?: string;
  email?: string;
  studioName?: string;
  ssoEnabled?: boolean;
  googleEmail?: string | null;
  addressStreet?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressZip?: string | null;
  addressCountry?: string | null;
}

interface SettingsIdentityTabProps {
  admin: Admin | null;
  logoPreview: string;
  uploadingLogo: boolean;
  removingLogo: boolean;
  logoInputRef: React.RefObject<HTMLInputElement>;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
  onProfileSaved: (updated: Admin) => void;
}

export const SettingsIdentityTab = ({
  admin,
  logoPreview,
  uploadingLogo,
  removingLogo,
  logoInputRef,
  onLogoUpload,
  onLogoRemove,
  onProfileSaved,
}: SettingsIdentityTabProps) => {
  const { t } = useI18n();
  const { data: supplierProducts = [], isLoading: productsLoading } = useAdminSupplierProducts();
  const toggleFavorite = useToggleSupplierFavorite();

  const [profile, setProfile] = useState({ name: admin?.name ?? '', studioName: admin?.studioName ?? '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [address, setAddress] = useState({
    addressStreet: admin?.addressStreet ?? '',
    addressApartment: admin?.addressApartment ?? '',
    addressCity: admin?.addressCity ?? '',
    addressZip: admin?.addressZip ?? '',
    addressCountry: admin?.addressCountry ?? 'ישראל',
  });
  const [savingAddress, setSavingAddress] = useState(false);

  const handleAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddress(true);
    try {
      const res = await api.patch('/auth/profile', {
        addressStreet: address.addressStreet,
        addressApartment: address.addressApartment,
        addressCity: address.addressCity,
        addressZip: address.addressZip,
        addressCountry: address.addressCountry,
      });
      onProfileSaved(res.data.admin ?? res.data);
      toast.success(t('admin.settings.address_saved'));
    } catch {
      toast.error(t('admin.settings.profile_failed'));
    } finally {
      setSavingAddress(false);
    }
  };

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.patch('/auth/profile', {
        name: profile.name || undefined,
        studioName: profile.studioName || undefined,
      });
      onProfileSaved(res.data);
      toast.success(t('admin.settings.profile_saved'));
      setProfileMsg('');
    } catch {
      toast.error(t('admin.settings.profile_failed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleFavorite = (product: AdminSupplierProduct) => {
    toggleFavorite.mutate(
      { productId: product.id, favorite: !product.isFavorite },
      { onError: () => toast.error(t('admin.common.error')) },
    );
  };

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl'>
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

      {/* Studio shipping address — used for direct supplier orders */}
      <div className='bg-card rounded-xl border border-beige p-6 lg:col-span-2'>
        <h2 className='font-semibold text-charcoal mb-1'>{t('admin.settings.studio_address')}</h2>
        <p className='text-xs text-warm-gray mb-4'>{t('admin.settings.studio_address_hint')}</p>
        <form onSubmit={handleAddress} className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='sm:col-span-2'>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_street')}</label>
            <InputField type='text' value={address.addressStreet} onChange={(e) => setAddress({ ...address, addressStreet: e.target.value })} />
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_apartment')}</label>
            <InputField type='text' value={address.addressApartment} onChange={(e) => setAddress({ ...address, addressApartment: e.target.value })} />
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_city')}</label>
            <InputField type='text' value={address.addressCity} onChange={(e) => setAddress({ ...address, addressCity: e.target.value })} />
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_zip')}</label>
            <InputField type='text' value={address.addressZip} onChange={(e) => setAddress({ ...address, addressZip: e.target.value })} />
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.address_country')}</label>
            <InputField type='text' value={address.addressCountry} onChange={(e) => setAddress({ ...address, addressCountry: e.target.value })} />
          </div>
          <div className='sm:col-span-2'>
            <Button type='submit' variant='primary' size='sm' disabled={savingAddress}>
              {savingAddress ? t('admin.common.saving') : t('admin.settings.save_profile')}
            </Button>
          </div>
        </form>
      </div>

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
            <input ref={logoInputRef} type='file' accept='image/*' className='hidden' onChange={onLogoUpload} />
            <Button type='button' variant='ghost' size='sm' onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo || removingLogo}>
              {uploadingLogo ? t('admin.common.uploading') : logoPreview ? t('admin.settings.logo_replace') : t('admin.settings.logo_upload')}
            </Button>
            {logoPreview && (
              <Button type='button' variant='ghost' size='sm' onClick={onLogoRemove} disabled={removingLogo || uploadingLogo}>
                {removingLogo ? '...' : t('admin.settings.logo_remove')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {admin?.id && (
        <div className='bg-card rounded-xl border border-beige p-6'>
          <h2 className='font-semibold text-charcoal mb-4'>{t('admin.settings.public_page_title')}</h2>
          <p className='text-xs text-warm-gray mb-2'>{t('admin.settings.public_page_label')}</p>
          <a href={`/${admin.id}`} target='_blank' rel='noreferrer' className='text-sm text-blush underline font-mono break-all'>
            {window.location.origin}/{admin.id}
          </a>
        </div>
      )}

      <div className='bg-card rounded-xl border border-beige p-6 lg:col-span-2'>
        <h2 className='font-semibold text-charcoal mb-1'>{t('admin.favorites.title')}</h2>
        <p className='text-xs text-warm-gray mb-4'>{t('admin.favorites.subtitle')}</p>

        {productsLoading ? (
          <p className='text-xs text-warm-gray'>{t('admin.common.loading')}</p>
        ) : supplierProducts.length === 0 ? (
          <p className='text-xs text-warm-gray'>{t('admin.favorites.empty')}</p>
        ) : (
          <ul className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {supplierProducts.map((p) => (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 transition-colors ${
                  p.isFavorite ? 'border-blush bg-blush/5' : 'border-beige'
                }`}
              >
                <div className='min-w-0'>
                  <span className='text-sm text-charcoal truncate block'>{p.name}</span>
                  <span className='text-xs text-warm-gray'>
                    {p.type} · ₪{p.costPrice}
                    {p.clientPrice != null ? ` · ${t('supplier.products.client_price')}: ₪${p.clientPrice}` : ''}
                    {' · '}{p.supplierName}
                  </span>
                </div>
                <button
                  type='button'
                  onClick={() => handleToggleFavorite(p)}
                  disabled={toggleFavorite.isPending}
                  aria-pressed={p.isFavorite}
                  aria-label={p.isFavorite ? t('admin.favorites.remove') : t('admin.favorites.add')}
                  title={p.isFavorite ? t('admin.favorites.remove') : t('admin.favorites.add')}
                  className={`shrink-0 transition-colors disabled:opacity-40 cursor-pointer ${
                    p.isFavorite ? 'text-blush hover:text-warm-gray' : 'text-warm-gray hover:text-blush'
                  }`}
                >
                  <Star size={16} fill={p.isFavorite ? 'currentColor' : 'none'} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
