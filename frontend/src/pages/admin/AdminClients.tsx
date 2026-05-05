import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { InputField } from '@/components/admin/InputField';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useI18n } from '@/lib/i18n';
import { useClients, useDeleteClient } from '@/hooks/useQueries';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useModal } from '@/hooks/useModal';
import { Modal } from '@/components/ui/Modal';
import { useSearch } from '@/hooks/useSearch';
import type { Client } from '@/types/admin';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { Button } from '@/components/admin/Button';
import { CreateClientWizard } from '@/components/admin/CreateClientWizard';

export const AdminClients = () => {
  const { t } = useI18n();
  const { data: clients = [], isLoading } = useClients();
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

      <CreateClientWizard isOpen={form.isOpen} onClose={form.close} />

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
                <th className='text-xs text-warm-gray font-medium px-4 py-3 text-start hidden lg:table-cell'>{t('admin.common.created_at')}</th>
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
                  <td className='px-4 py-3 text-warm-gray whitespace-nowrap hidden lg:table-cell text-xs'>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                  </td>
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
