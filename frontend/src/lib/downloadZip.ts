import JSZip from 'jszip';
import { getImageUrl } from '@/lib/api';

export interface ZipImageEntry {
  _id: string;
  path: string;
  filename: string;
  originalName?: string;
}

const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string): Promise<Blob | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads an array of images as a ZIP file.
 * Fetches up to CONCURRENCY images at a time to avoid browser connection limits.
 * Failed/timed-out images are skipped so the download never hangs indefinitely.
 *
 * @param images      - Array of image objects with `_id`, `path`, and `filename`
 * @param folderName  - Name of the folder inside the ZIP archive
 * @param zipName     - Filename for the downloaded `.zip` file (without extension)
 * @param onProgress  - Optional callback fired after each image completes (done, total)
 */
export async function downloadZip(
  images: ZipImageEntry[],
  folderName: string,
  zipName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(folderName) ?? zip;
  const total = images.length;
  let done = 0;

  // Process in fixed-size batches so we never fire more than CONCURRENCY fetches at once
  for (let i = 0; i < images.length; i += CONCURRENCY) {
    const batch = images.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (img) => {
        const url = getImageUrl(img.path);
        const blob = await fetchWithTimeout(url);
        if (blob) {
          const name = img.filename;
          const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
          folder.file(`${name.replace(/\.[^.]+$/, '') || img._id}${ext}`, blob);
        }
        done += 1;
        onProgress?.(done, total);
      }),
    );
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `${zipName}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}
