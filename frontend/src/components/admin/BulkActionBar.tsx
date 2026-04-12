import { Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  count: number;
  onClear: () => void;
  onDelete: () => void;
}

export const BulkActionBar = ({ count, onClear, onDelete }: Props) => {
  const { t } = useI18n();

  if (count === 0) return null;

  return (
    <div className='flex flex-wrap items-center gap-3 mb-4 px-4 py-3 bg-ivory rounded-xl border border-beige'>
      <span className='text-sm text-charcoal flex-1'>
        {count} {t('admin.upload.selected')}
      </span>
      <button onClick={onClear} className='text-xs text-warm-gray hover:text-charcoal transition-colors'>
        {t('admin.upload.clear_selection')}
      </button>
      <button
        onClick={onDelete}
        className='flex items-center gap-1.5 bg-rose-500 text-white px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium hover:bg-rose-600 transition-colors'
      >
        <Trash2 size={12} />
        {t('admin.upload.delete_selected')}
      </button>
    </div>
  );
};
