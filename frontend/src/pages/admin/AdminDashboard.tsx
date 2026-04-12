import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { InputField } from '@/components/admin/InputField';
import { AddGalleryModal } from '@/components/admin/AddGalleryModal';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { useGalleries, useClients } from '@/hooks/useQueries';
import {
  Users,
  Images,
  CheckSquare,
  ExternalLink,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/admin/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './dashboard/StatCard';
import { ClientRow } from './dashboard/ClientRow';
import { QuickAddClient } from './dashboard/QuickAddClient';
import { ActivityPanel } from './dashboard/ActivityPanel';
import { type FilterChip, type RichGallery, getClientFilter, matchesClient } from './dashboard/types';
import type { Client } from '@/types/admin';

export const AdminDashboard = () => {
  const { admin } = useAuth();
  const { t } = useI18n();
  const { data: galleriesRaw = [], isLoading: galleriesLoading } = useGalleries();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const isLoading = galleriesLoading || clientsLoading;

  const [filter, setFilter] = useState<FilterChip>('all');
  const [search, setSearch] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [addGalleryClient, setAddGalleryClient] = useState<Client | null>(null);

  const galleries = galleriesRaw as RichGallery[];

  const pendingCount = galleries.filter((g) => g.status === 'selection_submitted').length;

  const searchedClients = search.trim() ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) : clients;

  const filteredClients = filter === 'all' ? searchedClients : searchedClients.filter((c) => getClientFilter(c, galleries) === filter);

  const galleryCountForFiltered = galleries.filter((g) => filteredClients.some((c) => matchesClient(g, c))).length;

  const clientCountLabel =
    filteredClients.length === 1
      ? `1 ${t('admin.dashboard.client_singular')}`
      : `${filteredClients.length} ${t('admin.dashboard.client_plural')}`;

  const galleryCountLabel =
    galleryCountForFiltered === 1
      ? `1 ${t('admin.dashboard.gallery_singular')}`
      : `${galleryCountForFiltered} ${t('admin.dashboard.gallery_plural')}`;

  const FILTER_CHIPS: { key: FilterChip; labelKey: string }[] = [
    { key: 'all', labelKey: 'admin.dashboard.filter_all' },
    { key: 'active', labelKey: 'admin.dashboard.filter_active' },
    { key: 'pending', labelKey: 'admin.dashboard.filter_pending' },
    { key: 'delivered', labelKey: 'admin.dashboard.filter_delivered' },
  ];

  const topBarActions = (
    <>
      <div className='relative flex-1 max-w-xs'>
        <Search size={14} className='absolute top-1/2 -translate-y-1/2 start-3 text-warm-gray pointer-events-none' />
        <InputField
          type='text'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.dashboard.search_placeholder')}
          className='ps-8'
        />
      </div>
      <Button variant='dark' className='shrink-0' onClick={() => setShowNewClient(true)}>
        <Plus size={15} />
        {t('admin.dashboard.new_client_btn')}
      </Button>
    </>
  );

  return (
    <AdminLayout title={t('admin.nav.dashboard')} actions={topBarActions}>
      {showNewClient && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40' onClick={() => setShowNewClient(false)}>
          <div className='bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4' onClick={(e) => e.stopPropagation()}>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-base font-semibold text-charcoal'>{t('admin.dashboard.quick_add_title')}</h2>
              <button
                onClick={() => setShowNewClient(false)}
                className='p-1 rounded-xl text-warm-gray hover:bg-beige transition-colors'
              >
                <X size={16} />
              </button>
            </div>
            <QuickAddClient onSuccess={() => setShowNewClient(false)} />
          </div>
        </div>
      )}

      {admin?.id && (
        <div className='mb-6'>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`/${admin.id}`}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-900 text-white text-sm font-medium hover:bg-black transition-colors'
              >
                <ExternalLink size={15} />
                {t('admin.dashboard.view_landing')}
              </a>
            </TooltipTrigger>
            <TooltipContent>
              {window.location.origin}/{admin.id}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {isLoading ? (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
          {[0, 1, 2].map((i) => (
            <div key={i} className='bg-card rounded-xl border border-beige p-5 space-y-3'>
              <Skeleton className='h-8 w-16' />
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-3 w-32' />
            </div>
          ))}
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
          <StatCard
            label={t('admin.dashboard.clients')}
            value={clients.length}
            icon={Users}
            iconClass='bg-blue-100 text-blue-500'
            to='/admin/clients'
            sub={t('admin.dashboard.stat_clients_sub')}
          />
          <StatCard
            label={t('admin.dashboard.galleries')}
            value={galleries.length}
            icon={Images}
            iconClass='bg-purple-100 text-purple-500'
            to='/admin/clients'
            sub={t('admin.dashboard.stat_galleries_sub')}
          />
          <StatCard
            label={t('admin.dashboard.pending')}
            value={pendingCount}
            icon={CheckSquare}
            iconClass='bg-rose-100 text-rose-500'
            to='/admin/selections'
            sub={t('admin.dashboard.stat_pending_sub')}
          />
        </div>
      )}

      <div className='flex flex-col lg:flex-row gap-6 items-start'>
        <div className='flex-1 min-w-0'>
          <div className='bg-card rounded-xl border border-beige p-6'>
            <div className='flex items-center justify-between mb-5'>
              <h2 className=' text-lg text-charcoal'>{t('admin.dashboard.panel_title')}</h2>
            </div>

            {isLoading ? (
              <div className='flex flex-col gap-3'>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className='border border-beige rounded-xl p-4 flex items-center gap-3'>
                    <Skeleton className='h-9 w-9 rounded-full shrink-0' />
                    <div className='flex-1 space-y-2'>
                      <Skeleton className='h-4 w-40' />
                      <Skeleton className='h-3 w-24' />
                    </div>
                    <Skeleton className='h-5 w-16 rounded-full' />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className='flex flex-wrap gap-2 mb-4'>
                  {FILTER_CHIPS.map(({ key, labelKey }) => (
                    <button
                      key={key}
                      type='button'
                      onClick={() => setFilter(key)}
                      className={`px-3 py-1 rounded-full text-xs font-sans font-medium transition-colors border ${
                        filter === key
                          ? 'bg-charcoal text-white border-charcoal'
                          : 'bg-ivory text-warm-gray border-beige hover:border-charcoal hover:text-charcoal'
                      }`}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>

                <p className='text-xs text-warm-gray font-sans mb-4'>
                  {clientCountLabel} · {galleryCountLabel}
                </p>

                {filteredClients.length === 0 ? (
                  <p className='text-sm text-warm-gray'>{t('admin.dashboard.no_clients')}</p>
                ) : (
                  <div className='flex flex-col gap-3'>
                    {filteredClients.map((c) => (
                      <ClientRow key={c._id} client={c} galleries={galleries} onAddGallery={(c) => setAddGalleryClient(c)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className='w-full lg:w-[340px] shrink-0 flex flex-col gap-4'>
          <ActivityPanel clients={clients} />
          <QuickAddClient />
        </div>
      </div>
      {addGalleryClient && (
        <AddGalleryModal
          isOpen={!!addGalleryClient}
          onClose={() => setAddGalleryClient(null)}
          clients={clients}
          preselectedClient={addGalleryClient}
          onSuccess={() => setAddGalleryClient(null)}
        />
      )}
    </AdminLayout>
  );
};
