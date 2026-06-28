import { Camera } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Client } from '@/types/admin';
import { DashboardThumb } from './DashboardThumb';
import { matchesClient, type RichGallery } from './types';

interface UpcomingShootsProps {
  clients: Client[];
  galleries: RichGallery[];
}

const MAX_ROWS = 3;

export const UpcomingShoots = ({ clients, galleries }: UpcomingShootsProps) => {
  const { t, lang } = useI18n();
  const locale = lang === 'he' ? 'he-IL' : 'en-US';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const floor = startOfToday.getTime();

  const upcoming = clients
    .filter((c) => c.eventDate && new Date(c.eventDate).getTime() >= floor)
    .sort((a, b) => new Date(a.eventDate as string).getTime() - new Date(b.eventDate as string).getTime())
    .slice(0, MAX_ROWS);

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  };

  return (
    <div className='bg-card rounded-2xl border border-blush/20 p-4 md:p-5 flex flex-col min-h-0'>
      <div className='flex items-center gap-2 mb-3 shrink-0'>
        <Camera size={15} className='text-warm-gray' />
        <h3 className='text-sm font-sans font-semibold text-charcoal'>{t('admin.dashboard.upcoming_title')}</h3>
      </div>

      {upcoming.length === 0 ? (
        <p className='text-xs text-warm-gray'>{t('admin.dashboard.upcoming_empty')}</p>
      ) : (
        <ul className='flex flex-col gap-3'>
          {upcoming.map((c) => {
            const gallery = galleries.find((g) => matchesClient(g, c));
            const sessionLabel = c.sessionType ? t(`admin.session.${c.sessionType}`) : '';
            const title = sessionLabel ? `${sessionLabel} · ${c.name}` : c.name;
            return (
              <li key={c._id} className='flex items-center gap-3'>
                <DashboardThumb previewImages={gallery?.previewImages} alt={c.name} />
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-sans font-medium text-charcoal truncate'>{title}</p>
                  <p className='text-xs text-warm-gray mt-0.5'>{formatWhen(c.eventDate as string)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
