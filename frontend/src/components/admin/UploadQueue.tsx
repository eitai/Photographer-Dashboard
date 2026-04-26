import { useI18n } from '@/lib/i18n';
import { UploadFile } from '@/hooks/useGalleryUpload';
import { X } from 'lucide-react';

interface Props {
  queue: UploadFile[];
  isUploading: boolean;
  onCancel: () => void;
}

export const UploadQueue = ({ queue, isUploading, onCancel }: Props) => {
  const { t } = useI18n();

  if (queue.length === 0) return null;

  return (
    <div className='bg-card rounded-xl border border-beige p-4 mb-6 max-h-48 overflow-y-auto space-y-2'>
      <div className='flex items-center justify-between mb-1'>
        <span className='text-xs text-warm-gray font-medium'>
          {queue.filter((i) => i.done).length}/{queue.length}
        </span>
        {isUploading && (
          <button
            onClick={onCancel}
            className='flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 transition-colors'
            title={t('admin.upload.cancel')}
          >
            <X size={12} />
            {t('admin.upload.cancel')}
          </button>
        )}
      </div>
      {queue.map((item) => (
        <div key={item.id} className='flex items-center gap-3 text-xs'>
          <span className='text-warm-gray truncate flex-1'>{item.file.name}</span>
          <div className='w-24 h-1.5 bg-beige rounded-full overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all ${
                item.error ? 'bg-rose-400' : item.cancelled ? 'bg-warm-gray' : 'bg-blush'
              }`}
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <span
            className={
              item.error
                ? 'text-rose-500'
                : item.cancelled
                ? 'text-warm-gray'
                : item.done
                ? 'text-green-500'
                : 'text-warm-gray'
            }
          >
            {item.error
              ? t('admin.upload.error')
              : item.cancelled
              ? t('admin.upload.cancelled')
              : item.done
              ? t('admin.upload.done')
              : `${item.progress}%`}
          </span>
        </div>
      ))}
    </div>
  );
};
