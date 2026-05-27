import { Trash2, CheckSquare, Square, X, Images } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
}

export const BulkActionBar = ({ count, onClear, onDelete, onSelectAll, allSelected }: Props) => {
  const { t } = useI18n();

  if (count === 0) return null;

  return (
    <div className='flex flex-wrap items-center gap-2 mb-4 px-4 py-3 bg-ivory border border-beige rounded-2xl shadow-sm'>
      {/* Selection count */}
      <div className='flex items-center gap-2 flex-1 min-w-0'>
        <div className='flex items-center justify-center w-7 h-7 rounded-full bg-blush/30 shrink-0'>
          <Images size={13} className='text-charcoal' />
        </div>
        <span className='text-sm font-medium text-charcoal'>
          {count} {t('admin.upload.selected')}
        </span>
      </div>

      <div className='hidden sm:block w-px h-5 bg-beige' />

      {/* Select all / Deselect all */}
      {onSelectAll && (
        <button
          onClick={onSelectAll}
          className='flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-charcoal border border-beige bg-card hover:border-blush hover:bg-blush/10 transition-colors'
        >
          {allSelected ? (
            <>
              <CheckSquare size={12} />
            </>
          ) : (
            <>
              <Square size={12} />
            </>
          )}
          {t('admin.upload.select_all')}
        </button>
      )}

      {/* Clear */}
      <button
        onClick={onClear}
        className='flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-warm-gray border border-beige bg-white hover:border-blush hover:text-charcoal hover:bg-blush/10 transition-colors'
      >
        <X size={12} />
        {t('admin.upload.clear_selection')}
      </button>

      <div className='hidden sm:block w-px h-5 bg-beige' />

      {/* Delete */}
      <button
        onClick={onDelete}
        className='flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 border border-rose-500 hover:border-rose-600 transition-colors'
      >
        <Trash2 size={12} />
        {t('admin.upload.delete_selected')}
      </button>
    </div>
  );
};
