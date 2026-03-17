import { useI18n } from '@/lib/i18n';
import { UploadFile } from '@/hooks/useGalleryUpload';

interface Props {
  queue: UploadFile[];
}

export const UploadQueue = ({ queue }: Props) => {
  const { t } = useI18n();

  if (queue.length === 0) return null;

  return (
    <div className='bg-card rounded-xl border border-beige p-4 mb-6 max-h-48 overflow-y-auto space-y-2'>
      {queue.map((item) => (
        <div key={item.id} className='flex items-center gap-3 text-xs'>
          <span className='text-warm-gray truncate flex-1'>{item.file.name}</span>
          <div className='w-24 h-1.5 bg-beige rounded-full overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all ${item.error ? 'bg-rose-400' : 'bg-blush'}`}
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <span className={item.error ? 'text-rose-500' : item.done ? 'text-green-500' : 'text-warm-gray'}>
            {item.error ? t('admin.upload.error') : item.done ? t('admin.upload.done') : `${item.progress}%`}
          </span>
        </div>
      ))}
    </div>
  );
};
