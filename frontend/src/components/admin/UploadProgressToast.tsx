import { ArrowUpFromLine, X } from 'lucide-react';

interface UploadProgressToastProps {
  totalFiles: number;
  uploadedBytes: number;
  totalBytes: number;
  speedBps: number;
  onRequestCancel: () => void;
  dir: 'ltr' | 'rtl';
  t: (key: string) => string;
}

function formatPair(uploaded: number, total: number): [string, string] {
  const useGB = total >= 1024 * 1024 * 1024;
  const div   = useGB ? 1024 * 1024 * 1024 : 1024 * 1024;
  const unit  = useGB ? 'GB' : 'MB';
  return [
    `${(uploaded / div).toFixed(1)} ${unit}`,
    `${(total    / div).toFixed(1)} ${unit}`,
  ];
}

function formatSpeed(bps: number): string {
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function UploadProgressToast({
  totalFiles,
  uploadedBytes,
  totalBytes,
  speedBps,
  onRequestCancel,
  dir,
  t,
}: UploadProgressToastProps) {
  const pct = totalBytes > 0 ? Math.min((uploadedBytes / totalBytes) * 100, 100) : 0;
  const [uploadedStr, totalStr] = formatPair(uploadedBytes, totalBytes);
  const speedStr = formatSpeed(speedBps);

  return (
    <div
      dir={dir}
      className='bg-background border border-beige rounded-2xl shadow-lg w-[min(420px,calc(100vw-2rem))] overflow-hidden font-sans'
    >
      <div className='flex items-center gap-3 px-4 py-3'>
        <div className='shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blush/15'>
          <ArrowUpFromLine size={15} className='text-blush' />
        </div>

        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-charcoal leading-tight'>
            {t('admin.upload.toast_uploading').replace('{count}', String(totalFiles))}
          </p>
          <div className='flex items-center gap-1 mt-0.5 text-xs text-warm-gray tabular-nums'>
            <span className='font-medium text-charcoal'>{uploadedStr}</span>
            <span className='opacity-50'>/</span>
            <span>{totalStr}</span>
            <span className='opacity-40 mx-0.5'>•</span>
            <span>{speedStr}</span>
          </div>
        </div>

        <button
          onClick={onRequestCancel}
          className='shrink-0 flex items-center justify-center w-7 h-7 rounded-full hover:bg-rose-50 text-warm-gray hover:text-rose-500 transition-colors'
          aria-label={t('admin.common.close')}
        >
          <X size={13} />
        </button>
      </div>

      <div className='h-1 w-full bg-beige'>
        <div
          className='h-full bg-blush transition-all duration-300 ease-out'
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
