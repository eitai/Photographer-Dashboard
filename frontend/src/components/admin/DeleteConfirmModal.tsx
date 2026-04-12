import { useI18n } from '@/lib/i18n';
import { Modal } from '@/components/ui/Modal';

interface Props {
  count: number;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ count, deleting, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <Modal isOpen onClose={onCancel}>
      <h3 className=' text-lg text-charcoal mb-1'>{t('admin.upload.delete_confirm')}</h3>
      <p className='text-sm text-warm-gray mb-1'>
        <span className='font-medium text-charcoal'>
          {count} {t('admin.upload.images')}
        </span>
      </p>
      <p className='text-sm text-warm-gray mb-6'>{t('admin.upload.delete_body')}</p>
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
