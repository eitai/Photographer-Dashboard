import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useI18n } from '@/lib/i18n';
import { useClients, useCreateClient, useDeleteClient } from '@/hooks/useQueries';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useModal } from '@/hooks/useModal';
import { Modal } from '@/components/ui/Modal';
import { useSearch } from '@/hooks/useSearch';
import type { Client } from '@/types/admin';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';

const SESSION_TYPES = ['family', 'maternity', 'newborn', 'branding', 'landscape'] as const;

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.preprocess((val) => (val === '' ? undefined : val), z.string().email('Invalid email').optional()),
  sessionType: z.enum(SESSION_TYPES),
  notes: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export const AdminClients = () => {
  const { t } = useI18n();
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
    defaultValues: { name: '', phone: '', email: '', sessionType: 'family', notes: '' },
  });

  const onSubmit = async (data: ClientFormValues) => {
    await createClient.mutateAsync(data);
    form.close();
    reset();
  };

  return (
    <AdminLayout title={t('admin.clients.title')}>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center gap-3 mb-6'>
        <div className='relative flex-1 max-w-sm'>
          <Search size={15} className='absolute start-3 top-1/2 -translate-y-1/2 text-warm-gray' />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.clients.search')}
            className='w-full ps-9 pe-4 py-2 min-h-[44px] rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
          />
        </div>
        <button
          onClick={form.toggle}
          className='flex items-center gap-2 bg-transparent border border-black text-black px-4 py-2 min-h-[44px] rounded text-sm font-medium hover:bg-black/5 transition-colors'
        >
          <Plus size={15} /> {t('admin.clients.new')}
        </button>
      </div>

      {/* Create form */}
      {form.isOpen && (
        <form onSubmit={handleSubmit(onSubmit)} className='bg-card border border-beige rounded-xl p-6 mb-6 space-y-4'>
          <h3 className=' text-charcoal mb-2'>{t('admin.clients.new')}</h3>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.name')}</label>
              <input
                type='text'
                {...register('name')}
                className='w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
              {errors.name && <p className='text-xs text-rose-500 mt-1'>{errors.name.message}</p>}
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.phone')}</label>
              <input
                type='tel'
                {...register('phone')}
                className='w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.email')}</label>
              <input
                type='email'
                {...register('email')}
                className='w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
              {errors.email && <p className='text-xs text-rose-500 mt-1'>{errors.email.message}</p>}
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.session_type')}</label>
              <select
                {...register('sessionType')}
                className='w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              >
                {SESSION_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {t(`admin.session.${st}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.notes')}</label>
            <textarea
              {...register('notes')}
              rows={2}
              className='w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 resize-none'
            />
          </div>
          <div className='flex gap-3'>
            <button
              type='submit'
              disabled={createClient.isPending}
              className='bg-blush text-primary-foreground px-5 py-2 min-h-[44px] rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {createClient.isPending ? t('admin.common.saving') : t('admin.clients.create')}
            </button>
            <button
              type='button'
              onClick={() => {
                form.close();
                reset();
              }}
              className='px-5 py-2 min-h-[44px] rounded-lg text-sm text-warm-gray hover:bg-ivory transition-colors border border-beige'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className='bg-card rounded-xl border border-beige overflow-x-auto'>
        {isLoading ? (
          <p className='text-sm text-warm-gray p-6'>{t('admin.common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className='text-sm text-warm-gray p-6'>{t('admin.clients.no_clients')}</p>
        ) : (
          <table className='w-full text-sm table-fixed'>
            <colgroup>
              <col className='w-1/4' />
              <col className='w-[120px]' />
              <col className='w-1/4' />
              <col className='w-[140px]' />
              <col className='w-[130px]' />
              <col className='w-[80px]' />
            </colgroup>
            <thead className='bg-ivory border-b border-beige'>
              <tr>
                {[
                  t('admin.common.name'),
                  t('admin.clients.col_session'),
                  t('admin.common.email'),
                  t('admin.common.phone'),
                  t('admin.common.status'),
                  '',
                ].map((h, i) => (
                  <th key={i} className='text-xs text-warm-gray font-medium px-4 py-3'>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-beige'>
              {filtered.map((c) => (
                <tr key={c._id} className='hover:bg-ivory transition-colors'>
                  <td className='px-4 py-3 text-charcoal font-medium truncate'>{c.name}</td>
                  <td className='px-4 py-3 text-warm-gray'>{t(`admin.session.${c.sessionType}`)}</td>
                  <td className='px-4 py-3 text-warm-gray truncate'>{c.email || '—'}</td>
                  <td className='px-4 py-3 text-warm-gray whitespace-nowrap'>{c.phone || '—'}</td>
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
          <button
            onClick={deletion.confirm}
            disabled={deletion.deleting}
            className='flex-1 bg-rose-500 text-white py-3 min-h-[44px] rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
          >
            {deletion.deleting ? t('admin.clients.deleting') : t('admin.clients.delete_btn')}
          </button>
          <button
            onClick={deletion.cancel}
            disabled={deletion.deleting}
            className='flex-1 py-3 min-h-[44px] rounded-lg text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
          >
            {t('admin.common.cancel')}
          </button>
        </div>
      </Modal>
    </AdminLayout>
  );
};
