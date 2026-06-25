import { Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { DashboardThumb } from './DashboardThumb';
import { resolveClientId, type GalleryStatus, type RichGallery } from './types';

interface WaitingForDeliveryProps {
  galleries: RichGallery[];
}

const MAX_ROWS = 3;
const WAITING_STATUSES: GalleryStatus[] = ['selection_submitted', 'in_editing'];

const since = (g: RichGallery) => new Date(g.updatedAt ?? g.createdAt ?? 0).getTime();

export const WaitingForDelivery = ({ galleries }: WaitingForDeliveryProps) => {
  const { t } = useI18n();

  // Selection galleries past selection but not yet delivered, longest wait first.
  const candidates = galleries
    .filter((g) => !g.isDelivery && WAITING_STATUSES.includes(g.status as GalleryStatus))
    .sort((a, b) => since(a) - since(b));

  // One row per client (keep the longest-waiting gallery for each).
  const seen = new Set<string>();
  const waiting: RichGallery[] = [];
  for (const g of candidates) {
    const key = resolveClientId(g.clientId) ?? g.clientName ?? g._id;
    if (seen.has(key)) continue;
    seen.add(key);
    waiting.push(g);
    if (waiting.length === MAX_ROWS) break;
  }

  const waitLabel = (g: RichGallery) => {
    const days = Math.floor((Date.now() - since(g)) / 86_400_000);
    if (days <= 0) return t('admin.dashboard.waiting_today');
    if (days === 1) return t('admin.dashboard.waiting_one_day');
    return t('admin.dashboard.waiting_days').replace('{n}', String(days));
  };

  return (
    <div className='bg-card rounded-2xl shadow p-4 md:p-5 flex flex-col min-h-0'>
      <div className='flex items-center gap-2 mb-3 shrink-0'>
        <Clock size={15} className='text-warm-gray' />
        <h3 className='text-sm font-sans font-semibold text-charcoal'>{t('admin.dashboard.delivery_title')}</h3>
      </div>

      {waiting.length === 0 ? (
        <p className='text-xs text-warm-gray'>{t('admin.dashboard.delivery_empty')}</p>
      ) : (
        <ul className='flex flex-col gap-3'>
          {waiting.map((g) => (
            <li key={g._id} className='flex items-center gap-3'>
              <DashboardThumb galleryId={g._id} alt={g.clientName} />
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-sans font-medium text-charcoal truncate'>{g.clientName}</p>
                <p className='text-xs text-warm-gray mt-0.5'>{waitLabel(g)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
