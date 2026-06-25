import { Image as ImageIcon } from 'lucide-react';
import { useGalleryPreviewImages } from '@/hooks/useQueries';
import { getImageUrl } from '@/lib/api';

interface DashboardThumbProps {
  galleryId?: string;
  alt: string;
}

/**
 * Square-ish thumbnail for dashboard list rows. Pulls the first image of the
 * given gallery (cached via React Query) and falls back to a neutral
 * placeholder when the gallery has no images or no gallery is linked.
 */
export const DashboardThumb = ({ galleryId, alt }: DashboardThumbProps) => {
  const { data: images } = useGalleryPreviewImages(galleryId ?? '');
  const first = images?.[0];
  const src = first ? getImageUrl(first.thumbnailPath || first.path) : '';

  if (!src) {
    return (
      <div className='w-14 h-11 rounded-md bg-muted flex items-center justify-center shrink-0'>
        <ImageIcon size={16} className='text-warm-gray' />
      </div>
    );
  }

  return <img src={src} alt={alt} className='w-14 h-11 rounded-md object-cover shrink-0' loading='lazy' />;
};
