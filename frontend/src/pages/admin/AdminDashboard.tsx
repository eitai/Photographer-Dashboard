import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { useGalleries, useClients, useCreateClient } from '@/hooks/useQueries';
import { useToast } from '@/hooks/use-toast';
import { Users, Images, CheckSquare, ExternalLink, Mail, MoreHorizontal, ChevronDown, Link2, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Client } from '@/types/admin';
import type { GalleryData } from '@/types/gallery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterChip = 'all' | 'active' | 'pending' | 'delivered';

type GalleryStatus = GalleryData['status'];

interface RichGallery extends GalleryData {
  clientName: string;
  clientId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: GalleryStatus[] = ['viewed', 'selection_submitted', 'in_editing'];

function matchesClient(g: RichGallery, client: Client): boolean {
  return (g.clientName ?? '').trim().toLowerCase() === client.name.trim().toLowerCase();
}

function getClientFilter(client: Client, galleries: RichGallery[]): FilterChip {
  const clientGalleries = galleries.filter((g) => matchesClient(g, client));
  if (clientGalleries.length === 0) return 'pending';
  const hasActive = clientGalleries.some((g) => ACTIVE_STATUSES.includes(g.status as GalleryStatus));
  if (hasActive) return 'active';
  const allDelivered = clientGalleries.every((g) => g.status === 'delivered');
  if (allDelivered) return 'delivered';
  return 'pending';
}

function formatRelativeTime(dateStr: string | undefined, t: (k: string) => string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return t('admin.dashboard.time_just_now');
  if (mins < 60) return t('admin.dashboard.time_minutes_ago').replace('{n}', String(mins));
  if (hours < 24) return t('admin.dashboard.time_hours_ago').replace('{n}', String(hours));
  return t('admin.dashboard.time_days_ago').replace('{n}', String(days));
}

// ---------------------------------------------------------------------------
// Gallery thumbnail color mosaic
// ---------------------------------------------------------------------------

const MOSAIC_PALETTES: [string, string, string, string][] = [
  ['bg-rose-100', 'bg-rose-200', 'bg-pink-100', 'bg-pink-200'],
  ['bg-blue-100', 'bg-blue-200', 'bg-sky-100', 'bg-sky-200'],
  ['bg-purple-100', 'bg-purple-200', 'bg-violet-100', 'bg-violet-200'],
  ['bg-amber-100', 'bg-amber-200', 'bg-yellow-100', 'bg-yellow-200'],
  ['bg-emerald-100', 'bg-emerald-200', 'bg-teal-100', 'bg-teal-200'],
  ['bg-orange-100', 'bg-orange-200', 'bg-red-100', 'bg-red-200'],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getPalette(name: string): [string, string, string, string] {
  return MOSAIC_PALETTES[hashName(name) % MOSAIC_PALETTES.length];
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useI18n();
  let dotClass = 'bg-gray-400';
  let label = t('admin.dashboard.badge_pending');

  if (ACTIVE_STATUSES.includes(status as GalleryStatus)) {
    dotClass = 'bg-charcoal';
    label = t('admin.dashboard.badge_active');
  } else if (status === 'delivered') {
    dotClass = 'bg-gray-300';
    label = t('admin.dashboard.badge_delivered');
  }

  return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ivory border border-beige text-xs text-warm-gray font-sans'>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Gallery mosaic thumbnail
// ---------------------------------------------------------------------------

const GalleryMosaic = ({ name }: { name: string }) => {
  const [tl, tr, bl, br] = getPalette(name);
  return (
    <div className='w-10 h-10 rounded-md overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0'>
      <div className={tl} />
      <div className={tr} />
      <div className={bl} />
      <div className={br} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClass: string;
  to: string;
  sub: string;
}

const StatCard = ({ label, value, icon: Icon, iconClass, to, sub }: StatCardProps) => (
  <Link to={to} className='relative bg-card rounded-xl border border-beige p-5 hover:shadow-sm transition-shadow block'>
    <span className={`absolute top-3 end-3 w-7 h-7 rounded-full flex items-center justify-center ${iconClass}`}>
      <Icon size={13} />
    </span>
    <p className='text-3xl  text-charcoal leading-none mb-1'>{value}</p>
    <p className='text-sm font-sans font-medium text-charcoal'>{label}</p>
    <p className='text-xs text-warm-gray mt-0.5'>{sub}</p>
  </Link>
);

// ---------------------------------------------------------------------------
// Gallery card inside expanded client row
// ---------------------------------------------------------------------------

const GalleryCard = ({ gallery }: { gallery: RichGallery }) => {
  const { t } = useI18n();
  return (
    <div className='flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-ivory transition-colors'>
      <GalleryMosaic name={gallery.name} />
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-sans font-medium text-charcoal truncate'>{gallery.name}</p>
        {gallery.isDelivery && <span className='text-xs text-warm-gray font-sans'>{t('admin.client.delivery_badge')}</span>}
      </div>
      <StatusBadge status={gallery.status} />
      <button
        type='button'
        className='p-1.5 rounded-md text-warm-gray hover:text-charcoal hover:bg-beige transition-colors shrink-0'
        aria-label={t('admin.client.copy_link')}
      >
        <Link2 size={13} />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Expandable client row
// ---------------------------------------------------------------------------

const ClientRow = ({ client, galleries }: { client: Client; galleries: RichGallery[] }) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const initials = client.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const clientGalleries = galleries.filter((g) => matchesClient(g, client));

  const galleryCountLabel =
    clientGalleries.length === 1
      ? `1 ${t('admin.dashboard.gallery_singular')}`
      : `${clientGalleries.length} ${t('admin.dashboard.gallery_plural')}`;

  return (
    <div className='border border-beige rounded-xl overflow-hidden'>
      {/* Row header — div instead of button to allow nested buttons */}
      <div
        role='button'
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v);
        }}
        className='w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-ivory transition-colors cursor-pointer select-none'
      >
        <span className='w-9 h-9 rounded-full bg-blush/20 text-blush text-xs font-sans font-semibold flex items-center justify-center shrink-0'>
          {initials}
        </span>

        <div className='flex-1 min-w-0 text-start'>
          <p className='text-sm font-sans font-medium text-charcoal truncate'>{client.name}</p>
          <p className='text-xs text-warm-gray truncate'>
            {t(`admin.session.${client.sessionType}`)}
            {client.createdAt ? ` · ${new Date(client.createdAt).toLocaleDateString()}` : ''}
          </p>
        </div>

        <span className='text-xs text-warm-gray font-sans shrink-0'>{galleryCountLabel}</span>

        <button
          type='button'
          onClick={(e) => e.stopPropagation()}
          className='p-1.5 rounded-md text-warm-gray hover:text-charcoal hover:bg-beige transition-colors shrink-0'
          aria-label={`${t('admin.common.email')} ${client.name}`}
        >
          <Mail size={13} />
        </button>
        <button
          type='button'
          onClick={(e) => e.stopPropagation()}
          className='p-1.5 rounded-md text-warm-gray hover:text-charcoal hover:bg-beige transition-colors shrink-0'
        >
          <MoreHorizontal size={13} />
        </button>

        <ChevronDown size={15} className={`text-warm-gray shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className='bg-ivory border-t border-beige px-4 py-3'>
          <div className='flex items-center justify-between mb-2'>
            <p className='text-xs font-sans font-semibold text-warm-gray uppercase tracking-wide'>{t('admin.nav.galleries')}</p>
            <Link
              to={`/admin/clients/${client._id}`}
              className='inline-flex items-center gap-1 text-xs text-blush hover:underline font-sans'
            >
              <Plus size={11} />
              {t('admin.dashboard.add_gallery')}
            </Link>
          </div>
          {clientGalleries.length === 0 ? (
            <p className='text-xs text-warm-gray py-2'>{t('admin.dashboard.no_galleries_client')}</p>
          ) : (
            <div className='flex flex-col gap-1'>
              {clientGalleries.map((g) => (
                <GalleryCard key={g._id} gallery={g} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Quick add client form
// ---------------------------------------------------------------------------

const SESSION_TYPES: Client['sessionType'][] = ['family', 'maternity', 'newborn', 'branding', 'landscape'];

const QuickAddClient = () => {
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
    } catch {
      toast({
        title: t('admin.common.status'),
        description: t('admin.dashboard.client_create_error'),
        variant: 'destructive',
      });
    }
  };

  const inputClass =
    'w-full text-sm font-sans text-charcoal bg-ivory border border-beige rounded-lg px-3 py-2 placeholder:text-warm-gray focus:outline-none focus:ring-1 focus:ring-blush transition';

  return (
    <div className='bg-card rounded-xl border border-beige p-5'>
      <h3 className=' text-base text-charcoal mb-4'>{t('admin.dashboard.quick_add_title')}</h3>
      <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
        <input
          type='text'
          placeholder={t('admin.dashboard.client_name_ph')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          required
        />
        <select value={sessionType} onChange={(e) => setSessionType(e.target.value as Client['sessionType'])} className={inputClass}>
          {SESSION_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`admin.session.${s}`)}
            </option>
          ))}
        </select>
        <input
          type='tel'
          placeholder={t('admin.common.phone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
        <input
          type='email'
          placeholder={t('admin.common.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <button
          type='submit'
          disabled={createClient.isPending}
          className='mt-1 w-full py-2 rounded-lg bg-blush text-white text-sm font-sans font-medium hover:bg-blush/90 disabled:opacity-60 transition-colors'
        >
          {createClient.isPending ? t('admin.dashboard.creating_client') : t('admin.dashboard.create_client_btn')}
        </button>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Activity panel
// ---------------------------------------------------------------------------

const ActivityPanel = ({ clients }: { clients: Client[] }) => {
  const { t } = useI18n();

  const recent = [...clients]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  return (
    <div className='bg-card rounded-xl border border-beige p-5'>
      <h3 className=' text-base text-charcoal mb-4'>{t('admin.dashboard.activity_title')}</h3>
      {recent.length === 0 ? (
        <p className='text-xs text-warm-gray'>{t('admin.dashboard.no_activity')}</p>
      ) : (
        <ul className='flex flex-col gap-3'>
          {recent.map((c) => {
            const initials = c.name
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? '')
              .join('');
            return (
              <li key={c._id} className='flex items-start gap-3'>
                <span className='w-8 h-8 rounded-full bg-blush/20 text-blush text-xs font-sans font-semibold flex items-center justify-center shrink-0 mt-0.5'>
                  {initials}
                </span>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-sans text-charcoal leading-snug'>
                    {t('admin.dashboard.activity_new_client')}: <span className='font-medium'>{c.name}</span>
                  </p>
                  <p className='text-xs text-warm-gray mt-0.5'>{formatRelativeTime(c.createdAt, t)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const AdminDashboard = () => {
  const { admin } = useAuth();
  const { t } = useI18n();
  const { data: galleriesRaw = [] } = useGalleries();
  const { data: clients = [] } = useClients();

  const [filter, setFilter] = useState<FilterChip>('all');

  const galleries = galleriesRaw as unknown as RichGallery[];

  const pendingCount = galleries.filter((g) => g.status === 'selection_submitted').length;

  const filteredClients = filter === 'all' ? clients : clients.filter((c) => getClientFilter(c, galleries) === filter);

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

  return (
    <AdminLayout title={`${t('admin.dashboard.greeting')}, ${admin?.name?.split(' ')[0]} ✨`}>
      {/* Landing page link */}
      {admin?.id && (
        <div className='mb-6'>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`/${admin.id}`}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blush/10 border border-blush/30 text-blush text-sm font-medium hover:bg-blush/20 transition-colors'
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

      {/* Stat cards */}
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

      {/* Two-column layout */}
      <div className='flex flex-col lg:flex-row gap-6 items-start'>
        {/* Left: Clients & Galleries */}
        <div className='flex-1 min-w-0'>
          <div className='bg-card rounded-xl border border-beige p-6'>
            <div className='flex items-center justify-between mb-5'>
              <h2 className=' text-lg text-charcoal'>{t('admin.dashboard.panel_title')}</h2>
            </div>

            {/* Filter chips */}
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

            {/* Count label */}
            <p className='text-xs text-warm-gray font-sans mb-4'>
              {clientCountLabel} · {galleryCountLabel}
            </p>

            {/* Client rows */}
            {filteredClients.length === 0 ? (
              <p className='text-sm text-warm-gray'>{t('admin.dashboard.no_clients')}</p>
            ) : (
              <div className='flex flex-col gap-3'>
                {filteredClients.map((c) => (
                  <ClientRow key={c._id} client={c} galleries={galleries} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className='w-full lg:w-[340px] shrink-0 flex flex-col gap-4'>
          <ActivityPanel clients={clients} />
          <QuickAddClient />
        </div>
      </div>
    </AdminLayout>
  );
};
