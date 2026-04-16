import { useI18n } from '@/lib/i18n';
import { Modal } from '@/components/ui/Modal';

interface Props {
  count: number;
  deleting: boolean;
  progress?: { done: number; total: number } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ count, deleting, progress, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <Modal isOpen onClose={onCancel}>
      <h3 className=' text-lg text-charcoal mb-1'>{t('admin.upload.delete_confirm')}</h3>
      <p className='text-sm text-warm-gray mb-1'>
        <span className='font-medium text-charcoal'>
          {count} {t('admin.upload.images')}
        </span>
      </p>
      <p className='text-sm text-warm-gray mb-4'>{t('admin.upload.delete_body')}</p>

      {progress && (
        <div className='mb-4'>
          <div className='flex justify-between text-xs text-warm-gray mb-1'>
            <span>{t('admin.upload.deleting')}</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className='h-1.5 bg-beige rounded-full overflow-hidden'>
            <div
              className='h-full bg-rose-400 rounded-full transition-all duration-200'
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className='flex gap-3'>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className='flex-1 bg-rose-500 text-white py-3 min-h-[44px] rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
        >
          {deleting ? t('admin.upload.deleting') : t('admin.common.delete')}
        </button>
        <button
          onClick={onCancel}
          disabled={deleting}
          className='flex-1 py-3 min-h-[44px] rounded-xl text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
        >
          {t('admin.common.cancel')}
        </button>
      </div>
    </Modal>
  );
}
