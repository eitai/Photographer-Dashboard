import { useI18n } from '@/lib/i18n';
import type { Client } from '@/types/admin';
import { formatRelativeTime } from './types';
import { AvatarInitials } from '@/components/admin/AvatarInitials';

export const ActivityPanel = ({ clients }: { clients: Client[] }) => {
  const { t } = useI18n();

  const recent = [...clients]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  return (
    <div className='bg-card rounded-xl border border-blush/20 p-5 flex flex-col h-full'>
      <h3 className=' text-base text-charcoal mb-4 shrink-0'>{t('admin.dashboard.activity_title')}</h3>
      {recent.length === 0 ? (
        <p className='text-xs text-warm-gray'>{t('admin.dashboard.no_activity')}</p>
      ) : (
        <ul className='flex flex-col gap-3 overflow-y-auto'>
          {recent.map((c) => {
            return (
              <li key={c._id} className='flex items-start gap-3'>
                <div className='mt-0.5'>
                  <AvatarInitials name={c.name} size='sm' />
                </div>
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
