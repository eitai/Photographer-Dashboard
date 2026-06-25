import { useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getImageUrl } from '@/lib/api';
import { downloadZip } from '@/lib/downloadZip';
import type { ProductOrder } from '@/services/productOrderService';

interface Props {
  order: ProductOrder;
}

export const ProductOrderPhotos = ({ order }: Props) => {
  const { t } = useI18n();
  const [downloading, setDownloading] = useState(false);

  if (order.status !== 'submitted' || order.selectedPhotoIds.length === 0) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadZip(
        order.selectedPhotoIds.map((photo) => ({
          _id: photo.imageId,
          path: photo.path,
          filename: photo.filename,
        })),
        order.name,
        order.name.replace(/\s+/g, '-'),
      );
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  };

  return (
    <div className='px-4 py-3'>
      <div className='flex items-center gap-3 mb-2'>
        <p className='text-xs text-green-700'>
          {order.selectedPhotoIds.length} {t('admin.products.photos_chosen')}
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className='flex items-center gap-1 text-xs bg-blush text-primary-foreground px-2.5 py-1 rounded-xl hover:bg-blush/80 transition-colors disabled:opacity-60'
        >
          <Download size={11} />
          {downloading ? 'Downloading...' : 'Download All'}
        </button>
      </div>
      <div className='grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5'>
        {order.selectedPhotoIds.map((photo) => (
          <a
            key={photo.imageId}
            href={getImageUrl(photo.path)}
            target='_blank'
            rel='noopener noreferrer'
            className='aspect-square rounded-md overflow-hidden bg-beige block hover:opacity-80 transition-opacity'
            title={photo.filename}
          >
            {/* Thumbnail only — never decode the full-resolution original for a tile.
                The link still opens the original. */}
            {photo.thumbnailPath ? (
              <img
                src={getImageUrl(photo.thumbnailPath)}
                alt={photo.filename}
                className='w-full h-full object-cover'
                loading='lazy'
              />
            ) : (
              <span className='w-full h-full flex items-center justify-center'>
                <ImageIcon size={14} className='text-warm-gray/50' />
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
};
