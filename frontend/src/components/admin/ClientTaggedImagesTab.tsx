import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getClientTaggedImages, getImageUrl, type TaggedImagesPage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Images, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { GalleryImage } from '@/types/admin';

interface TaggedImage extends GalleryImage {
  confidence?: number;
  galleryId?: string;
  galleryName?: string;
}

interface ClientTaggedImagesTabProps {
  clientId: string;
}

const PAGE_SIZE = 50;

const QUERY_KEY = (clientId: string, page: number) =>
  ['clientTaggedImages', clientId, page] as const;

export const ClientTaggedImagesTab = ({ clientId }: ClientTaggedImagesTabProps) => {
  const { t } = useI18n();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<TaggedImagesPage>({
    queryKey: QUERY_KEY(clientId, page),
    queryFn: () => getClientTaggedImages(clientId, page, PAGE_SIZE),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const images = (data?.images ?? []) as TaggedImage[];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-16 text-warm-gray gap-2'>
        <Loader2 size={16} className='animate-spin' />
        <span className='text-sm'>{t('admin.face.tagged_loading')}</span>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (isError) {
    return (
      <div className='text-center py-16'>
        <p className='text-sm text-rose-500'>{t('admin.face.tagged_load_failed')}</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  if (images.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 gap-3 text-warm-gray'>
        <span className='flex items-center justify-center w-12 h-12 rounded-full bg-blush/10'>
          <Images size={22} className='text-blush' />
        </span>
        <p className='text-sm font-medium text-charcoal'>{t('admin.face.tagged_empty_title')}</p>
        <p className='text-xs text-warm-gray text-center max-w-xs'>
          {t('admin.face.tagged_empty_desc')}
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Grid
  // -------------------------------------------------------------------------
  return (
    <div className='space-y-4'>
      {/* Result count */}
      <p className='text-xs text-warm-gray'>
        {total} {t('admin.face.tagged_matched')}
      </p>

      {/* Thumbnail grid */}
      <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3'>
        {images.map((img) => {
          const thumb = img.thumbnailPath ?? img.path;
          const galleryPath = img.galleryId
            ? `/admin/galleries/${img.galleryId}`
            : undefined;

          const card = (
            <div className='group relative aspect-square rounded-xl overflow-hidden border border-beige bg-muted/20'>
              <img
                src={getImageUrl(thumb)}
                alt={img.originalName}
                className='w-full h-full object-cover transition-transform duration-200 group-hover:scale-105'
                loading='lazy'
              />

              {/* Confidence badge */}
              {typeof img.confidence === 'number' && (
                <span className='absolute top-1.5 end-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blush/90 text-white leading-none'>
                  {Math.round(img.confidence * 100)}%
                </span>
              )}

              {/* Gallery name overlay */}
              {img.galleryName && (
                <div className='absolute bottom-0 start-0 end-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent'>
                  <p className='text-[10px] text-white truncate'>{img.galleryName}</p>
                </div>
              )}
            </div>
          );

          return galleryPath ? (
            <Link key={img.id} to={galleryPath} className='block'>
              {card}
            </Link>
          ) : (
            <div key={img.id}>{card}</div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-center gap-3 pt-2'>
          <button
            type='button'
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg border border-beige text-warm-gray transition-colors',
              page <= 1
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:border-blush hover:text-blush',
            )}
            aria-label={t('admin.face.prev_page')}
          >
            <ChevronLeft size={14} />
          </button>

          <span className='text-xs text-warm-gray'>
            {t('admin.face.page_of').replace('{page}', String(page)).replace('{total}', String(totalPages))}
          </span>

          <button
            type='button'
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg border border-beige text-warm-gray transition-colors',
              page >= totalPages
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:border-blush hover:text-blush',
            )}
            aria-label={t('admin.face.next_page')}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
