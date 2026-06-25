import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSupplierAuth } from '@/hooks/useSupplierAuth';
import { useSupplierStore } from '@/store/supplierStore';
import { updateSupplierProfile, changeSupplierPassword } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export const SupplierSettings = () => {
  const { t, dir } = useI18n();
  const { supplier } = useSupplierAuth();
  const setSupplier = useSupplierStore((s) => s.setSupplier);
  const { toast } = useToast();

  // ── Profile form ───────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    name:          supplier?.name          ?? '',
    phone:         supplier?.phone         ?? '',
    contactPerson: supplier?.contactPerson ?? '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const handleProfileChange = (field: keyof typeof profileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await updateSupplierProfile({
        name:          profileForm.name          || undefined,
        phone:         profileForm.phone          || null,
        contactPerson: profileForm.contactPerson  || null,
      });
      setSupplier(res.supplier);
      toast({ description: t('supplier.settings.profile_saved') });
    } catch {
      toast({ variant: 'destructive', description: dir === 'rtl' ? 'שגיאה בשמירה' : 'Failed to save profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Password form ──────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [pwError, setPwError]   = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handlePwChange = (field: keyof typeof pwForm, value: string) => {
    setPwForm((prev) => ({ ...prev, [field]: value }));
    if (pwError) setPwError('');
  };

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError(t('supplier.settings.password_mismatch'));
      return;
    }
    setPwSaving(true);
    try {
      await changeSupplierPassword(pwForm.currentPassword, pwForm.newPassword);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ description: t('supplier.settings.password_changed') });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? (dir === 'rtl' ? 'שגיאה בעדכון הסיסמה' : 'Failed to update password'));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className='p-6 md:p-8 max-w-xl'>
      <h1 className='text-2xl font-semibold text-foreground tracking-tight mb-8'>
        {t('supplier.settings.title')}
      </h1>

      {/* Profile section */}
      <section className='mb-10'>
        <h2 className='text-sm font-semibold uppercase tracking-widest text-foreground mb-5'>
          {t('supplier.settings.profile')}
        </h2>

        <form onSubmit={handleProfileSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='sup-name' className='text-xs uppercase tracking-widest text-muted-foreground'>
              {t('admin.suppliers.name')}
            </Label>
            <Input
              id='sup-name'
              value={profileForm.name}
              onChange={(e) => handleProfileChange('name', e.target.value)}
              required
              className='bg-background border-border'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='sup-phone' className='text-xs uppercase tracking-widest text-muted-foreground'>
              {t('admin.suppliers.phone')}
            </Label>
            <Input
              id='sup-phone'
              value={profileForm.phone}
              onChange={(e) => handleProfileChange('phone', e.target.value)}
              className='bg-background border-border'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='sup-contact' className='text-xs uppercase tracking-widest text-muted-foreground'>
              {t('admin.suppliers.contact')}
            </Label>
            <Input
              id='sup-contact'
              value={profileForm.contactPerson}
              onChange={(e) => handleProfileChange('contactPerson', e.target.value)}
              className='bg-background border-border'
            />
          </div>

          <div className='pt-1'>
            <Button
              type='submit'
              disabled={profileSaving}
              className='bg-foreground text-background hover:bg-foreground/90 rounded-xl px-5 h-9 text-sm font-medium'
            >
              {profileSaving
                ? (dir === 'rtl' ? 'שומר...' : 'Saving...')
                : t('supplier.settings.save_profile')}
            </Button>
          </div>
        </form>
      </section>

      <div className='border-t border-border mb-10' />

      {/* Password section */}
      <section>
        <h2 className='text-sm font-semibold uppercase tracking-widest text-foreground mb-5'>
          {t('supplier.settings.change_password')}
        </h2>

        <form onSubmit={handlePwSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='cur-pw' className='text-xs uppercase tracking-widest text-muted-foreground'>
              {t('supplier.settings.current_password')}
            </Label>
            <Input
              id='cur-pw'
              type='password'
              value={pwForm.currentPassword}
              onChange={(e) => handlePwChange('currentPassword', e.target.value)}
              required
              autoComplete='current-password'
              className='bg-background border-border'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='new-pw' className='text-xs uppercase tracking-widest text-muted-foreground'>
              {t('supplier.settings.new_password')}
            </Label>
            <Input
              id='new-pw'
              type='password'
              value={pwForm.newPassword}
              onChange={(e) => handlePwChange('newPassword', e.target.value)}
              required
              minLength={8}
              autoComplete='new-password'
              className='bg-background border-border'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='confirm-pw' className='text-xs uppercase tracking-widest text-muted-foreground'>
              {t('supplier.settings.confirm_password')}
            </Label>
            <Input
              id='confirm-pw'
              type='password'
              value={pwForm.confirmPassword}
              onChange={(e) => handlePwChange('confirmPassword', e.target.value)}
              required
              autoComplete='new-password'
              className='bg-background border-border'
            />
          </div>

          {pwError && (
            <p className='text-xs text-destructive' role='alert'>
              {pwError}
            </p>
          )}

          <div className='pt-1'>
            <Button
              type='submit'
              disabled={pwSaving}
              className='bg-foreground text-background hover:bg-foreground/90 rounded-xl px-5 h-9 text-sm font-medium'
            >
              {pwSaving
                ? (dir === 'rtl' ? 'מעדכן...' : 'Updating...')
                : t('supplier.settings.update_password')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};
