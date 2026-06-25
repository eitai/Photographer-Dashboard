import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { InputField, SelectField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { QuotaSlider } from '@/components/admin/QuotaSlider';
import { useCreateAdmin } from '@/hooks/useQueries';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'admin' as const, username: '', studioName: '', quotaGB: 10 as number | null };
const labelClass = 'block text-xs text-warm-gray mb-1';

interface Props {
  onCreated: () => void;
}

export const CreateAdminForm = ({ onCreated }: Props) => {
  const { t } = useI18n();
  const createAdminMutation = useCreateAdmin();
  const [form, setForm] = useState(EMPTY_FORM);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    createAdminMutation.mutate(form, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        toast.success(t('admin.users.created'));
        onCreated();
      },
      onError: (err: unknown) => {
        const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        toast.error(message || t('admin.users.create_error'));
      },
    });
  };

  const creating = createAdminMutation.isPending;

  return (
    <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
      <h2 className='text-charcoal'>{t('admin.users.add_new')}</h2>
      <form onSubmit={handleCreate} className='space-y-4'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelClass}>{t('admin.common.name')}</label>
            <InputField type='text' value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required placeholder={t('admin.common.full_name_ph')} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.common.email')}</label>
            <InputField type='email' value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required placeholder={t('admin.users.email_ph')} />
          </div>
          <div>
            <label className={labelClass}>{t('admin.users.password')}</label>
            <InputField type='password' value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required placeholder={t('admin.users.password_hint')} />
            <p className='text-[10px] text-warm-gray mt-0.5'>{t('admin.users.password_hint_full')}</p>
          </div>
          <div>
            <label className={labelClass}>{t('admin.users.role')}</label>
            <SelectField value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'superadmin' }))}>
              <option value='admin'>{t('admin.users.admin_label')}</option>
              <option value='superadmin'>{t('admin.users.superadmin_label')}</option>
            </SelectField>
          </div>
          <div>
            <label className={labelClass}>{t('admin.users.username_url')}</label>
            <InputField type='text' value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              placeholder={t('admin.users.username_ph')} className='font-mono' />
            <p className='text-[10px] text-warm-gray mt-0.5'>{t('admin.users.username_hint')}</p>
          </div>
          <div>
            <label className={labelClass}>{t('admin.settings.studio_name')}</label>
            <InputField type='text' value={form.studioName}
              onChange={(e) => setForm((f) => ({ ...f, studioName: e.target.value }))}
              placeholder={t('admin.users.studio_name_ph')} />
          </div>
          <div className='sm:col-span-2'>
            <QuotaSlider value={form.quotaGB} onChange={(v) => setForm((f) => ({ ...f, quotaGB: v }))} />
          </div>
        </div>
        <Button type='submit' variant='primary' disabled={creating}>
          <Plus size={15} />
          {creating ? t('admin.users.creating') : t('admin.users.create')}
        </Button>
      </form>
    </div>
  );
};
