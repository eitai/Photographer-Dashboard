import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { useGalleries, useClients, useBlogCount } from '@/hooks/useQueries';
import { Users, Images, CheckSquare, BookOpen, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const AdminDashboard = () => {
  const { admin } = useAuth();
  const { t } = useI18n();
  const { data: galleries = [] } = useGalleries();
  const { data: clients = [] } = useClients();
  const { data: blogCount = 0 } = useBlogCount();

  const STAT_CARDS = [
    { labelKey: 'admin.dashboard.clients', value: clients.length, icon: Users, to: '/admin/clients', color: 'text-blue-500' },
    { labelKey: 'admin.dashboard.galleries', value: galleries.length, icon: Images, to: '/admin/clients', color: 'text-purple-500' },
    {
      labelKey: 'admin.dashboard.pending',
      value: galleries.filter((g) => g.status === 'selection_submitted').length,
      icon: CheckSquare,
      to: '/admin/selections',
      color: 'text-rose-500',
    },
    { labelKey: 'admin.dashboard.blog_posts', value: blogCount, icon: BookOpen, to: '/admin/blog', color: 'text-green-500' },
  ];

  const recentClients = clients.slice(0, 5);

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
      {/* Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        {STAT_CARDS.map(({ labelKey, value, icon: Icon, to, color }) => (
          <Link key={labelKey} to={to} className='bg-card rounded-xl border border-beige p-5 hover:shadow-sm transition-shadow'>
            <div className={`mb-3 ${color}`}>
              <Icon size={20} />
            </div>
            <p className='text-2xl  text-charcoal'>{value}</p>
            <p className='text-xs text-warm-gray mt-0.5'>{t(labelKey)}</p>
          </Link>
        ))}
      </div>

      {/* Recent Clients */}
      <div className='bg-card rounded-xl border border-beige p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className=' text-charcoal'>{t('admin.dashboard.recent_clients')}</h2>
          <Link to='/admin/clients' className='text-xs text-blush hover:underline'>
            {t('admin.dashboard.view_all')}
          </Link>
        </div>
        {recentClients.length === 0 ? (
          <p className='text-sm text-warm-gray'>{t('admin.dashboard.no_clients')}</p>
        ) : (
          <div className='divide-y divide-beige'>
            {recentClients.map((c) => (
              <Link
                key={c._id}
                to={`/admin/clients/${c._id}`}
                className='flex items-center justify-between py-3 hover:bg-ivory -mx-6 px-6 transition-colors'
              >
                <div>
                  <p className='text-sm text-charcoal font-medium'>{c.name}</p>
                  <p className='text-xs text-warm-gray'>
                    {c.sessionType} · {c.email}
                  </p>
                </div>
                <span className='text-xs text-warm-gray'>{new Date(c.createdAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
