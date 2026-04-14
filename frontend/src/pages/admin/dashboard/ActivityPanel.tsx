import { useI18n } from '@/lib/i18n';
import type { Client } from '@/types/admin';
import { formatRelativeTime } from './types';

export const ActivityPanel = ({ clients }: { clients: Client[] }) => {
  const { t } = useI18n();

  const recent = [...clients]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  return (
    <div className='bg-white rounded-xl shadow p-5 flex flex-col h-full'>
      <h3 className=' text-base text-charcoal mb-4 shrink-0'>{t('admin.dashboard.activity_title')}</h3>
      {recent.length === 0 ? (
        <p className='text-xs text-warm-gray'>{t('admin.dashboard.no_activity')}</p>
      ) : (
        <ul className='flex flex-col gap-3 overflow-y-auto'>
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
