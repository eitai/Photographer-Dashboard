import { Image as ImageIcon } from 'lucide-react';
import { getImageUrl } from '@/lib/api';
import type { GalleryPreviewImage } from '@/types/gallery';

interface DashboardThumbProps {
  /** Pre-loaded preview images from the gallery list response. When provided the
   *  component renders purely from props with no network call. */
  previewImages?: GalleryPreviewImage[];
  alt: string;
}

/**
 * Square-ish thumbnail for dashboard list rows. Renders the first available
 * preview image from the embedded gallery list data and falls back to a neutral
 * placeholder when no images are present.
 */
export const DashboardThumb = ({ previewImages = [], alt }: DashboardThumbProps) => {
  const first = previewImages.find((img) => img.thumbnailPath ?? img.previewPath);
  const src = first ? getImageUrl((first.thumbnailPath ?? first.previewPath)!) : '';

  if (!src) {
    return (
      <div className='w-14 h-11 rounded-md bg-muted flex items-center justify-center shrink-0'>
        <ImageIcon size={16} className='text-warm-gray' />
      </div>
    );
  }

  return <img src={src} alt={alt} className='w-14 h-11 rounded-md object-cover shrink-0' loading='lazy' />;
};
