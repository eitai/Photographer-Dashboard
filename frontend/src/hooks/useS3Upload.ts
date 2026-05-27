/**
 * React hook around the multipart S3/Wasabi uploader.
 *
 * Exposes a single `upload(file, galleryId)` action plus reactive
 * state for the current progress, error, and an abortable `cancel()`.
 *
 * The hook deliberately does NOT touch the React Query cache — callers
 * decide whether (and how) to invalidate gallery queries on success.
 * That keeps this primitive reusable from anywhere (the upcoming
 * Slice 3 gallery integration, dev tools, batch uploaders, etc.).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  uploadFile,
  uploadFileWithJxlSidecar,
  type UploadOptions,
  type UploadProgress,
  type UploadResult,
} from '@/lib/uploader';

export interface UseS3UploadReturn {
  upload: (file: File, galleryId: string) => Promise<UploadResult>;
  progress: UploadProgress | null;
  error: Error | null;
  isUploading: boolean;
  cancel: () => void;
}

type UploaderFn = (file: File, opts: UploadOptions) => Promise<UploadResult>;

/**
 * Internal factory shared by both hooks. Holds all the controller/refs/state
 * plumbing in one place so the JXL-aware variant is a tiny one-liner that
 * swaps the underlying uploader.
 */
const useS3UploadInternal = (uploader: UploaderFn): UseS3UploadReturn => {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Refs so callbacks stay stable and we never set state on an unmounted
  // component (long uploads can outlive the page).
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  // Pin the uploader function across renders so `upload`'s identity stays
  // stable (callers passing it to memoized children won't re-render).
  const uploaderRef = useRef<UploaderFn>(uploader);
  uploaderRef.current = uploader;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cancel any in-flight upload on unmount so we don't leak network +
      // worker resources, and the server-side multipart upload is cleaned up.
      controllerRef.current?.abort();
    };
  }, []);

  const upload = useCallback(
    async (file: File, galleryId: string): Promise<UploadResult> => {
      // If a previous upload is still running, cancel it before starting a new one.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (mountedRef.current) {
        setError(null);
        setIsUploading(true);
        setProgress({
          phase: 'hashing',
          bytesUploaded: 0,
          totalBytes: file.size,
        });
      }

      const opts: UploadOptions = {
        galleryId,
        signal: controller.signal,
        onProgress: (p) => {
          if (mountedRef.current) setProgress(p);
        },
      };

      try {
        const result = await uploaderRef.current(file, opts);
        if (mountedRef.current) setIsUploading(false);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Upload failed');
        if (mountedRef.current) {
          setError(e);
          setIsUploading(false);
        }
        throw e;
      } finally {
        // Only clear if this is still the active controller (a newer call may
        // have replaced it before our `finally` ran).
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    [],
  );

  const cancel = useCallback((): void => {
    controllerRef.current?.abort();
  }, []);

  return { upload, progress, error, isUploading, cancel };
};

/**
 * Default S3 multipart upload hook — original file only, no JXL sidecar.
 * Behavior is unchanged from Slice 2.
 */
export function useS3Upload(): UseS3UploadReturn {
  return useS3UploadInternal(uploadFile);
}

/**
 * Same as `useS3Upload`, but for PNG/JPEG inputs also encodes a lossless
 * JXL sidecar in a Web Worker and uploads it via the new
 * /api/uploads/:assetId/jxl/* endpoints after the original succeeds.
 *
 * For non-eligible inputs (MP4, etc.) this behaves identically to
 * `useS3Upload`. JXL failures are non-fatal: the original asset is returned
 * to the caller and the JXL phase logs a console warning.
 */
export function useS3UploadWithJxl(): UseS3UploadReturn {
  return useS3UploadInternal(uploadFileWithJxlSidecar);
}
