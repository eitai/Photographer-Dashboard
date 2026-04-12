import JSZip from 'jszip';
import api, { API_BASE } from '@/lib/api';

export interface ZipImageEntry {
  _id: string;
  path: string;
  filename: string;
}

/**
 * Downloads an array of images as a ZIP file.
 *
 * @param images     - Array of image objects with `_id`, `path`, and `filename`
 * @param folderName - Name of the folder inside the ZIP archive
 * @param zipName    - Filename for the downloaded `.zip` file (without extension)
 */
export async function downloadZip(
  images: ZipImageEntry[],
  folderName: string,
  zipName: string,
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(folderName) ?? zip;

  await Promise.all(
    images.map(async (img) => {
      const url = `${API_BASE}${img.path}`;
      const res = await api.get(url, { responseType: 'blob' });
      const ext = img.filename.includes('.') ? `.${img.filename.split('.').pop()}` : '';
      folder.file(`${img._id}${ext}`, res.data);
    }),
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `${zipName}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}
