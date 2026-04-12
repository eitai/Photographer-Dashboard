import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useCreateClient } from '@/hooks/useQueries';
import { useToast } from '@/hooks/use-toast';
import { InputField, SelectField } from '@/components/admin/InputField';
import type { Client } from '@/types/admin';

export const SESSION_TYPES: Client['sessionType'][] = ['family', 'maternity', 'newborn', 'branding', 'landscape'];

export const QuickAddClient = ({ onSuccess }: { onSuccess?: () => void }) => {
  const createClient = useCreateClient();
  const { toast } = useToast();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [sessionType, setSessionType] = useState<Client['sessionType']>('family');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createClient.mutateAsync({ name: name.trim(), sessionType, phone, email });
      toast({
        title: t('admin.dashboard.client_created_title'),
        description: t('admin.dashboard.client_created_desc').replace('{name}', name.trim()),
      });
      setName('');
      setPhone('');
      setEmail('');
      setSessionType('family');
      onSuccess?.();
    } catch {
      toast({
        title: t('admin.common.status'),
        description: t('admin.dashboard.client_create_error'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className='bg-card rounded-xl border border-beige p-5'>
      <h3 className=' text-base text-charcoal mb-4'>{t('admin.dashboard.quick_add_title')}</h3>
      <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
        <InputField
          type='text'
          placeholder={t('admin.dashboard.client_name_ph')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <SelectField value={sessionType} onChange={(e) => setSessionType(e.target.value as Client['sessionType'])}>
          {SESSION_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`admin.session.${s}`)}
            </option>
          ))}
        </SelectField>
        <InputField type='tel' placeholder={t('admin.common.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <InputField type='email' placeholder={t('admin.common.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <button
          type='submit'
          disabled={createClient.isPending}
          className='mt-1 w-full py-2 rounded-xl bg-blush text-white text-sm font-sans font-medium hover:bg-blush/90 disabled:opacity-60 transition-colors'
        >
          {createClient.isPending ? t('admin.dashboard.creating_client') : t('admin.dashboard.create_client_btn')}
        </button>
      </form>
    </div>
  );
};
