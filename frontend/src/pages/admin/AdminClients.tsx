import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { InputField, TextareaField } from '@/components/admin/InputField';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useI18n } from '@/lib/i18n';
import { useClients, useCreateClient, useDeleteClient } from '@/hooks/useQueries';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useModal } from '@/hooks/useModal';
import { Modal } from '@/components/ui/Modal';
import { useSearch } from '@/hooks/useSearch';
import type { Client } from '@/types/admin';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { Button } from '@/components/admin/Button';


type ClientFormValues = { name: string; phone?: string; email?: string; notes?: string };

export const AdminClients = () => {
  const { t } = useI18n();
  const clientSchema = useMemo(() => z.object({
    name: z.string().min(1, t('admin.clients.name_required')),
    phone: z.preprocess((val) => (val === '' ? undefined : val), z.string().regex(/^[0-9+\-\s().]{7,20}$/, t('admin.clients.invalid_phone')).optional()),
    email: z.preprocess((val) => (val === '' ? undefined : val), z.string().email(t('admin.clients.invalid_email')).optional()),
    notes: z.string().optional(),
  }), [t]);
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();

  const form = useModal();
  const {
    query: search,
    setQuery: setSearch,
    filtered,
  } = useSearch<Client>(clients, (c, q) => c.name.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q) ?? false));
  const deletion = useDeleteConfirmation<{ _id: string; name: string }>(
    useCallback(
      async (target) => {
        await deleteClient.mutateAsync(target._id);
      },
      [deleteClient],
    ),
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', phone: '', email: '', notes: '' },
  });

  const closeAndReset = () => {
    form.close();
    reset();
  };

  const onSubmit = async (data: ClientFormValues) => {
    await createClient.mutateAsync(data);
    closeAndReset();
  };

  const displaySessionType = (st: string) => {
    const translated = t(`admin.session.${st}`);
    return translated.startsWith('admin.session.') ? st : translated;
  };

  return (
    <AdminLayout title={t('admin.clients.title')}>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center gap-3 mb-6'>
        <div className='relative flex-1 max-w-sm'>
          <Search size={15} className='absolute start-3 top-1/2 -translate-y-1/2 text-warm-gray' />
          <InputField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.clients.search')}
            className='ps-9 pe-4 min-h-[44px]'
          />
        </div>
        <Button
          variant='ghost'
          size='lg'
          onClick={form.toggle}
        >
          <Plus size={15} /> {t('admin.clients.new')}
        </Button>
      </div>

      {/* Create client modal */}
      <Modal isOpen={form.isOpen} onClose={closeAndReset} maxWidth='max-w-lg'>
        <h3 className='text-lg text-charcoal mb-4'>{t('admin.clients.new')}</h3>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.name')}</label>
              <InputField
                type='text'
                {...register('name')}
                className='py-2.5 min-h-[44px]'
              />
              {errors.name && <p className='text-xs text-rose-500 mt-1'>{errors.name.message}</p>}
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.phone')}</label>
              <InputField
                type='tel'
                {...register('phone')}
                className='py-2.5 min-h-[44px]'
              />
              {errors.phone && <p className='text-xs text-rose-500 mt-1'>{errors.phone.message}</p>}
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.email')}</label>
              <InputField
                type='email'
                {...register('email')}
                className='py-2.5 min-h-[44px]'
              />
              {errors.email && <p className='text-xs text-rose-500 mt-1'>{errors.email.message}</p>}
            </div>
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.notes')}</label>
            <TextareaField
              {...register('notes')}
              rows={2}
              className='py-2.5 min-h-[44px]'
            />
          </div>
          <div className='flex gap-3 pt-1'>
            <Button type='submit' variant='primary' size='lg' className='flex-1' disabled={createClient.isPending}>
              {createClient.isPending ? t('admin.common.saving') : t('admin.clients.create')}
            </Button>
            <Button type='button' variant='ghost' size='lg' className='flex-1' onClick={closeAndReset}>
              {t('admin.common.cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Table */}
      <div className='bg-card rounded-xl border border-beige overflow-x-auto'>
        {isLoading ? (
          <div className='p-6 space-y-3'>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className='flex items-center gap-4'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-4 flex-1' />
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-5 w-20 rounded-full' />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className='text-sm text-warm-gray p-6'>{t('admin.clients.no_clients')}</p>
        ) : (
          <table className='w-full text-sm'>
            <thead className='bg-ivory border-b border-beige'>
              <tr>
                <th className='text-xs text-warm-gray font-medium px-4 py-3 text-start'>{t('admin.common.name')}</th>
                <th className='text-xs text-warm-gray font-medium px-4 py-3 text-start hidden sm:table-cell'>{t('admin.clients.col_session')}</th>
                <th className='text-xs text-warm-gray font-medium px-4 py-3 text-start hidden md:table-cell'>{t('admin.common.email')}</th>
                <th className='text-xs text-warm-gray font-medium px-4 py-3 text-start hidden md:table-cell'>{t('admin.common.phone')}</th>
                <th className='text-xs text-warm-gray font-medium px-4 py-3 text-start'>{t('admin.common.status')}</th>
                <th className='w-[80px]' />
              </tr>
            </thead>
            <tbody className='divide-y divide-beige'>
              {filtered.map((c) => (
                <tr key={c._id} className='hover:bg-ivory transition-colors'>
                  <td className='px-4 py-3 text-charcoal font-medium'>
                    <div className='truncate max-w-[160px] sm:max-w-none'>{c.name}</div>
                    <div className='text-xs text-warm-gray mt-0.5 sm:hidden'>{c.email || c.phone || ''}</div>
                  </td>
                  <td className='px-4 py-3 text-warm-gray hidden sm:table-cell'>{displaySessionType(c.sessionType)}</td>
                  <td className='px-4 py-3 text-warm-gray hidden md:table-cell'>
                    <div className='truncate max-w-[180px]'>{c.email || '—'}</div>
                  </td>
                  <td className='px-4 py-3 text-warm-gray whitespace-nowrap hidden md:table-cell'>{c.phone || '—'}</td>
                  <td className='px-4 py-3'>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-3'>
                      <Link to={`/admin/clients/${c._id}`} className='text-xs text-blush hover:underline whitespace-nowrap'>
                        {t('admin.clients.view')}
                      </Link>
                      <button
                        onClick={() => deletion.setTarget({ _id: c._id, name: c.name })}
                        className='text-warm-gray hover:text-rose-500 transition-colors p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center -m-2.5'
                        title={t('admin.clients.delete_btn')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deletion.target} onClose={deletion.cancel}>
        <h3 className=' text-lg text-charcoal mb-1'>{t('admin.clients.delete_title')}</h3>
        <p className='text-sm text-warm-gray mb-1'>
          <span className='font-medium text-charcoal'>{deletion.target?.name}</span>
        </p>
        <p className='text-sm text-warm-gray mb-6'>{t('admin.clients.delete_body')}</p>
        <div className='flex gap-3'>
          <Button
            variant='danger'
            size='lg'
            className='flex-1'
            onClick={deletion.confirm}
            disabled={deletion.deleting}
          >
            {deletion.deleting ? t('admin.clients.deleting') : t('admin.clients.delete_btn')}
          </Button>
          <Button
            variant='ghost'
            size='lg'
            className='flex-1'
            onClick={deletion.cancel}
            disabled={deletion.deleting}
          >
            {t('admin.common.cancel')}
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
};
