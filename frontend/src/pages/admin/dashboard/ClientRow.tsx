import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { ChevronDown, Plus } from 'lucide-react';
import type { Client } from '@/types/admin';
import { GalleryCard } from './DashboardGalleryCard';
import { matchesClient, type RichGallery } from './types';

interface ClientRowProps {
  client: Client;
  galleries: RichGallery[];
  onAddGallery: (client: Client) => void;
}

export const ClientRow = ({ client, galleries, onAddGallery }: ClientRowProps) => {
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
    <div className='border-b border-gray-100 last:border-b-0'>
      <div
        role='button'
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v);
        }}
        className='w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer select-none'
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
        <ChevronDown size={15} className={`text-warm-gray shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </div>
      <div
        className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className='overflow-hidden'>
        <div className='bg-gray-50 border-t border-gray-100 px-4 py-3'>
          <div className='flex items-center justify-between mb-2'>
            <p className='text-xs font-sans font-semibold text-warm-gray uppercase tracking-wide'>{t('admin.nav.galleries')}</p>
            <button
              type='button'
              onClick={() => onAddGallery(client)}
              className='inline-flex items-center gap-1 text-xs text-blush hover:underline font-sans'
            >
              <Plus size={12} />
              {t('admin.dashboard.add_gallery')}
            </button>
          </div>
          {clientGalleries.length === 0 ? (
            <p className='text-xs text-warm-gray py-2'>{t('admin.dashboard.no_galleries_client')}</p>
          ) : (
            <div className='flex flex-col gap-2'>
              {clientGalleries.map((g) => (
                <GalleryCard key={g._id} gallery={g} client={client} />
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
