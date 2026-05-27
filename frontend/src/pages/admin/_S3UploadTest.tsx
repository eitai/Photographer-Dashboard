/**
 * Dev-only test harness for the multipart S3/Wasabi uploader.
 *
 * NOT a production page — gated behind `?s3test=1` in the route handler so
 * it cannot be reached accidentally. Lets a developer pick a local file and
 * exercise the full hash → init → upload → complete pipeline against the
 * real backend, with a live progress bar.
 *
 * Slice 3 will replace `useGalleryUpload`'s multipart POST with the same
 * uploader; this page is the bridge that proves the contract works
 * end-to-end before we touch the user-facing flow.
 */
import { useState } from 'react';
import { Navigate, useSearchParams, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useS3Upload, useS3UploadWithJxl } from '@/hooks/useS3Upload';
import type { UploadResult } from '@/lib/uploader';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
};

export const S3UploadTest = () => {
  const [params] = useSearchParams();
  const { galleryId: galleryIdParam } = useParams<{ galleryId?: string }>();

  const [file, setFile] = useState<File | null>(null);
  const [galleryId, setGalleryId] = useState<string>(galleryIdParam ?? '');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [jxlEnabled, setJxlEnabled] = useState<boolean>(false);

  // Always render BOTH hooks so we don't violate rules-of-hooks when the
  // user toggles the checkbox between uploads. Pick the one that matches
  // the current toggle when we actually launch an upload.
  const plain = useS3Upload();
  const withJxl = useS3UploadWithJxl();
  const active = jxlEnabled ? withJxl : plain;
  const { upload, progress, error, isUploading, cancel } = active;

  // Feature-flag the route — even if mounted, refuse to render unless ?s3test=1.
  // Hooks must be declared before any early return to satisfy rules-of-hooks.
  if (params.get('s3test') !== '1') {
    return <Navigate to='/admin' replace />;
  }

  const handleUpload = async (): Promise<void> => {
    if (!file || !galleryId) return;
    setResult(null);
    try {
      const r = await upload(file, galleryId);
      setResult(r);
    } catch {
      // Error is already surfaced via the hook's `error` state.
    }
  };

  const pct =
    progress && progress.totalBytes > 0
      ? Math.round((progress.bytesUploaded / progress.totalBytes) * 100)
      : 0;

  return (
    <div className='mx-auto max-w-2xl space-y-6 p-8'>
      <div>
        <h1 className='text-2xl font-semibold'>S3 Multipart Upload — Dev Test</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Dev-only harness. Drives <code>uploadFile()</code> end-to-end against
          the real backend. Not exposed in navigation.
        </p>
      </div>

      <label className='block space-y-1'>
        <span className='text-sm font-medium'>Gallery ID</span>
        <input
          type='text'
          value={galleryId}
          onChange={(e) => setGalleryId(e.target.value)}
          placeholder='e.g. 8b2c…'
          className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
          disabled={isUploading}
        />
      </label>

      <label className='block space-y-1'>
        <span className='text-sm font-medium'>File</span>
        <input
          type='file'
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className='block w-full text-sm'
          disabled={isUploading}
        />
        {file && (
          <p className='text-xs text-muted-foreground'>
            {file.name} — {formatBytes(file.size)} — {file.type || 'unknown type'}
          </p>
        )}
      </label>

      <label className='flex items-start gap-2 text-sm'>
        <input
          type='checkbox'
          checked={jxlEnabled}
          onChange={(e) => setJxlEnabled(e.target.checked)}
          disabled={isUploading}
          className='mt-1'
        />
        <span>
          <span className='font-medium'>Encode JXL sidecar (PNG/JPEG only)</span>
          <span className='block text-xs text-muted-foreground'>
            After the original uploads, encode lossless JPEG XL in a Web Worker
            and upload to <code>/api/uploads/:assetId/jxl/*</code>. Other mime
            types pass through unchanged.
          </span>
        </span>
      </label>

      <div className='flex gap-2'>
        <Button onClick={handleUpload} disabled={!file || !galleryId || isUploading}>
          {isUploading ? 'Uploading…' : 'Upload'}
        </Button>
        <Button variant='outline' onClick={cancel} disabled={!isUploading}>
          Cancel
        </Button>
      </div>

      {progress && (
        <div className='space-y-2 rounded-md border p-4'>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-medium capitalize'>{progress.phase}</span>
            <span className='tabular-nums text-muted-foreground'>
              {formatBytes(progress.bytesUploaded)} / {formatBytes(progress.totalBytes)} ({pct}%)
            </span>
          </div>
          <Progress value={pct} />
          {progress.totalParts !== undefined && (
            <p className='text-xs text-muted-foreground'>
              Part {progress.currentPart ?? 0} / {progress.totalParts}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
          {error.message}
        </div>
      )}

      {result && (
        <div className='space-y-1 rounded-md border border-green-500/40 bg-green-500/5 p-4 text-sm'>
          <p className='font-medium'>Upload complete</p>
          <pre className='overflow-x-auto text-xs'>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default S3UploadTest;
