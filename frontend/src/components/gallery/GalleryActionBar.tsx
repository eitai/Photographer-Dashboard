import { Download, Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Props {
  selectedCount: number;
  maxSelections: number;
  hasLimit: boolean;
  atMax: boolean;
  selectionEnabled: boolean;
  isDownloadingAll: boolean;
  downloadAllProgress: { done: number; total: number } | null;
  isDownloading: boolean;
  downloadProgress: { done: number; total: number } | null;
  onDownloadAll: () => void;
  onDownloadSelected: () => void;
  onSubmit: () => void;
}

export function GalleryActionBar({
  selectedCount, maxSelections, hasLimit, atMax, selectionEnabled,
  isDownloadingAll, downloadAllProgress, isDownloading, downloadProgress,
  onDownloadAll, onDownloadSelected, onSubmit,
}: Props) {
  const { t } = useI18n();

  const ghostBtn =
    'flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background text-sm font-body font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground';

  return (
    <div className='sticky top-14 z-40 backdrop-blur-sm py-2.5 mb-4 -mx-6 px-6 bg-background/90 border-b border-border'>
      <div className='flex items-center justify-between gap-x-3 gap-y-2 flex-wrap max-w-[1100px] mx-auto'>
        {/* Live selection count — mirrors the landing hero mini-gallery */}
        <div className='min-w-0'>
          <p
            aria-live='polite'
            className={`text-sm font-body font-semibold whitespace-nowrap ${selectedCount > 0 ? 'text-flag-ink' : 'text-muted-foreground'}`}
          >
            {hasLimit
              ? `${selectedCount} / ${maxSelections}`
              : t('gallery.selected_count').replace('{count}', String(selectedCount))}
            {atMax && (
              <span className='ms-2 text-xs font-normal text-muted-foreground'>
                — {t('gallery.max_reached')}
              </span>
            )}
          </p>
          {hasLimit && (
            <div className='mt-1.5 h-0.5 w-28 rounded-full bg-muted overflow-hidden' aria-hidden='true'>
              <div
                className='h-full rounded-full bg-flag transition-[width] duration-300 ease-out'
                style={{ width: `${Math.min(100, (selectedCount / maxSelections) * 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className='flex items-center gap-2 flex-wrap'>
          <button onClick={onDownloadAll} disabled={isDownloadingAll} className={ghostBtn}>
            <Download size={14} />
            {isDownloadingAll && downloadAllProgress
              ? `${downloadAllProgress.done} / ${downloadAllProgress.total}`
              : t('gallery.download_all')}
          </button>
          <button
            onClick={onDownloadSelected}
            disabled={selectedCount === 0 || isDownloading}
            className={ghostBtn}
          >
            <Download size={14} />
            {isDownloading && downloadProgress
              ? `${downloadProgress.done} / ${downloadProgress.total}`
              : t('gallery.download_selected')}
          </button>
          {selectionEnabled && (
            <button
              onClick={onSubmit}
              disabled={selectedCount === 0}
              className='flex items-center gap-2 px-6 py-2 rounded-full bg-foreground text-background text-sm font-body font-medium
                transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                disabled:opacity-40 disabled:hover:scale-100'
            >
              <Send size={14} />
              {t('gallery.send_selection')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
