/**
 * Slice 5C — folder upload queue UI.
 *
 * Renders one row per file with: name, type icon, per-file progress, status,
 * and final size + savings %. Renders an aggregate progress bar above the list
 * (bytes-based, not file-count-based — a 1 GB raw next to a 10 KB sidecar
 * shouldn't pretend they're the same chunk of work). When the batch settles,
 * we surface a summary line "Uploaded N/M files. Saved X (Y%)".
 */
import { Image as ImageIcon, FileVideo, File as FileIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/i18n';
import type {
  FolderUploadFile,
  FolderUploadSummary,
  FileItemStatus,
} from '@/hooks/useGalleryFolderUpload';

interface Props {
  queue: FolderUploadFile[];
  summary: FolderUploadSummary;
  isUploading: boolean;
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
};

const FileTypeIcon = ({ file }: { file: File }): JSX.Element => {
  const t = file.type;
  if (t.startsWith('image/'))
    return <ImageIcon size={14} className='text-warm-gray shrink-0' />;
  if (t.startsWith('video/'))
    return <FileVideo size={14} className='text-warm-gray shrink-0' />;
  return <FileIcon size={14} className='text-warm-gray shrink-0' />;
};

const statusLabelKey = (status: FileItemStatus): string => {
  switch (status) {
    case 'queued':
      return 'admin.upload.queued';
    case 'hashing':
      return 'admin.upload.hashing';
    case 'encoding':
      return 'admin.upload.encoding';
    case 'uploading':
      return 'admin.upload.uploading';
    case 'completing':
      return 'admin.upload.completing';
    case 'done':
      return 'admin.upload.done';
    case 'failed':
      return 'admin.upload.error';
  }
};

const statusToneClass = (status: FileItemStatus): string => {
  if (status === 'failed') return 'text-rose-500';
  if (status === 'done') return 'text-green-600';
  return 'text-warm-gray';
};

const barColorClass = (status: FileItemStatus): string => {
  if (status === 'failed') return 'bg-rose-400';
  if (status === 'done') return 'bg-green-500';
  return 'bg-blush';
};

export const FolderUploadQueue = ({ queue, summary, isUploading }: Props): JSX.Element | null => {
  const { t } = useI18n();
  if (queue.length === 0) return null;

  const overallPct =
    summary.totalBytes > 0
      ? Math.min(100, Math.round((summary.bytesUploaded / summary.totalBytes) * 100))
      : 0;

  // Savings is only meaningful once at least one file has finished — and even
  // then only if `finalBytes` actually came back smaller than the source.
  // We compute against the source bytes of completed files, NOT the whole
  // batch (otherwise the percentage moves around as more files finish).
  let completedSourceBytes = 0;
  for (const it of queue) {
    if (it.status === 'done') completedSourceBytes += it.file.size;
  }
  const savedBytes =
    summary.doneCount > 0
      ? Math.max(0, completedSourceBytes - summary.storedBytes)
      : 0;
  const savedPct =
    completedSourceBytes > 0
      ? Math.round((savedBytes / completedSourceBytes) * 100)
      : 0;

  const settled = !isUploading && summary.doneCount + summary.failedCount === summary.totalCount;

  return (
    <Card className='mb-6 border-beige bg-card'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base font-medium text-charcoal flex items-center justify-between gap-2'>
          <span>{t('admin.upload.overall')}</span>
          <span className='text-xs font-normal text-warm-gray tabular-nums'>
            {formatBytes(summary.bytesUploaded)} / {formatBytes(summary.totalBytes)} · {overallPct}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Progress value={overallPct} className='h-2' />

        {settled && (
          <div className='flex items-start gap-2 rounded-lg bg-ivory border border-beige px-3 py-2 text-xs text-charcoal'>
            {summary.failedCount === 0 ? (
              <CheckCircle2 size={14} className='text-green-600 mt-0.5 shrink-0' />
            ) : (
              <AlertTriangle size={14} className='text-amber-500 mt-0.5 shrink-0' />
            )}
            <div className='flex-1 min-w-0'>
              <div>
                {t('admin.upload.summary_files')
                  .replace('{done}', String(summary.doneCount))
                  .replace('{total}', String(summary.totalCount))}
                {summary.failedCount > 0 && (
                  <span className='text-rose-500 ms-2'>
                    ·{' '}
                    {t('admin.upload.summary_failed').replace(
                      '{count}',
                      String(summary.failedCount),
                    )}
                  </span>
                )}
              </div>
              {savedBytes > 0 && (
                <div className='text-warm-gray mt-0.5'>
                  {formatBytes(savedBytes)} saved ({savedPct}%)
                </div>
              )}
            </div>
          </div>
        )}

        <div className='max-h-72 overflow-y-auto space-y-1.5 pr-1'>
          {queue.map((item) => {
            const tone = statusToneClass(item.status);
            const bar = barColorClass(item.status);
            const label = t(statusLabelKey(item.status));
            const savedThis =
              item.status === 'done' && item.finalBytes !== undefined
                ? Math.max(0, item.file.size - item.finalBytes)
                : 0;
            return (
              <div
                key={item.id}
                className='flex items-center gap-2 text-xs py-1'
                title={item.error ? item.error : item.relativePath}
              >
                <FileTypeIcon file={item.file} />
                <span className='text-charcoal truncate flex-1' dir='ltr'>
                  {item.relativePath}
                </span>
                <span className='text-warm-gray tabular-nums shrink-0'>
                  {formatBytes(item.file.size)}
                </span>
                <div className='w-20 h-1.5 bg-beige rounded-full overflow-hidden shrink-0'>
                  <div
                    className={`h-full rounded-full transition-all ${bar}`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <span className={`shrink-0 min-w-[64px] text-right ${tone}`}>
                  {label}
                </span>
                {savedThis > 0 && (
                  <span className='text-green-600 tabular-nums shrink-0 min-w-[56px] text-right'>
                    -{formatBytes(savedThis)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
