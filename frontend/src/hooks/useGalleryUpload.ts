import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { queryKeys } from '@/hooks/useQueries';

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  done: boolean;
  error: boolean;
  cancelled: boolean;
}

export interface UploadStats {
  totalBytes: number;
  uploadedBytes: number;
  speedBps: number;
  totalFiles: number;
}

const MAX_IMAGE_SIZE = 40 * 1024 * 1024; // 40 MB per file
const MAX_BATCH_BYTES = 50 * 1024 * 1024; // 50 MB per request (Cloudflare free plan cap is 100 MB — stay well under)
const PARALLEL_BATCHES = 2;              // concurrent requests

export function useGalleryUpload(galleryId: string | undefined, onUploadComplete: () => void) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTotalBytesRef = useRef(0);
  const sessionUploadedBytesRef = useRef(0);
  const speedWindowRef = useRef<{ t: number; b: number }[]>([]);

  const scheduleClear = useCallback(() => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    clearTimeoutRef.current = setTimeout(() => {
      clearTimeoutRef.current = null;
      setQueue([]);
      setUploadStats(null);
    }, 2000);
  }, []);

  const cancelUpload = useCallback(() => {
    activeControllersRef.current.forEach((c) => c.abort());
    activeControllersRef.current.clear();
    // Reset input so the user can re-select the same files after cancelling
    if (inputRef.current) inputRef.current.value = '';
    setQueue((q) =>
      q.map((item) =>
        !item.done && !item.error ? { ...item, cancelled: true, progress: 0 } : item,
      ),
    );
    scheduleClear();
  }, [scheduleClear]);

  const handleFiles = useCallback(
    async (files: FileList | File[], folderId?: string | null) => {
      const arr: File[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) {
          toast.error(t('admin.upload.invalid_type').replace('{{name}}', f.name));
          continue;
        }
        if (f.size > MAX_IMAGE_SIZE) {
          toast.error(t('admin.upload.file_too_large').replace('{{name}}', f.name));
          continue;
        }
        arr.push(f);
      }

      if (arr.length === 0) return;

      // Cancel any pending queue-clear from a previous upload/cancel
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
      // Reset input so the user can re-select the same files next time
      if (inputRef.current) inputRef.current.value = '';

      const newItems: UploadFile[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        progress: 0,
        done: false,
        error: false,
        cancelled: false,
      }));
      setQueue((q) => [...q, ...newItems]);

      // Reset session-level byte accounting for this upload run
      sessionTotalBytesRef.current = arr.reduce((s, f) => s + f.size, 0);
      sessionUploadedBytesRef.current = 0;
      speedWindowRef.current = [];
      setUploadStats({
        totalBytes: sessionTotalBytesRef.current,
        uploadedBytes: 0,
        speedBps: 0,
        totalFiles: arr.length,
      });

      // Each upload session gets its own AbortController so parallel sessions don't interfere
      const controller = new AbortController();
      activeControllersRef.current.add(controller);

      // Split into size-capped batches so no single request exceeds MAX_BATCH_BYTES
      const batches: UploadFile[][] = [];
      let current: UploadFile[] = [];
      let currentBytes = 0;
      for (const item of newItems) {
        if (current.length > 0 && currentBytes + item.file.size > MAX_BATCH_BYTES) {
          batches.push(current);
          current = [];
          currentBytes = 0;
        }
        current.push(item);
        currentBytes += item.file.size;
      }
      if (current.length > 0) batches.push(current);

      const uploadBatch = async (batch: UploadFile[]) => {
        const batchIds = batch.map((b) => b.id);
        const formData = new FormData();
        batch.forEach((b) => formData.append('images', b.file));
        if (folderId) formData.append('folderId', folderId);

        const batchTotalBytes = batch.reduce((s, b) => s + b.file.size, 0);
        let batchLastReported = 0;

        try {
          await api.post(`/galleries/${galleryId}/images`, formData, {
            headers: { 'Content-Type': undefined },
            signal: controller.signal,
            onUploadProgress: (evt) => {
              const loaded = evt.loaded ?? 0;
              const delta = loaded - batchLastReported;
              batchLastReported = loaded;
              if (delta <= 0) return;

              sessionUploadedBytesRef.current += delta;

              // Rolling 2-second window for speed calculation
              const now = Date.now();
              speedWindowRef.current.push({ t: now, b: delta });
              speedWindowRef.current = speedWindowRef.current.filter((e) => now - e.t < 2000);
              const windowBytes = speedWindowRef.current.reduce((s, e) => s + e.b, 0);
              const windowMs = now - (speedWindowRef.current[0]?.t ?? now);
              const speedBps = windowMs > 0 ? (windowBytes / windowMs) * 1000 : 0;

              setUploadStats({
                totalBytes: sessionTotalBytesRef.current,
                uploadedBytes: Math.min(sessionUploadedBytesRef.current, sessionTotalBytesRef.current),
                speedBps,
                totalFiles: arr.length,
              });

              // Per-file progress bar: cap at 95% until server confirms
              const batchPct = Math.min(Math.round((loaded / batchTotalBytes) * 95), 95);
              setQueue((q) =>
                q.map((item) =>
                  batchIds.includes(item.id) && !item.done && !item.error && !item.cancelled
                    ? { ...item, progress: batchPct }
                    : item,
                ),
              );
            },
          });
          setQueue((q) =>
            q.map((item) => (batchIds.includes(item.id) ? { ...item, progress: 100, done: true } : item)),
          );
          queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
          onUploadComplete();
        } catch (err: any) {
          if (err?.code === 'ERR_CANCELED' || controller.signal.aborted) {
            // Cancelled — queue state already handled by cancelUpload()
            return;
          }
          if (err?.response?.status === 413 && err?.response?.data?.code === 'QUOTA_EXCEEDED') {
            const { used, quota } = err.response.data;
            const usedGB  = used  ? (used  / 1024 ** 3).toFixed(1) : '?';
            const quotaGB = quota ? (quota / 1024 ** 3).toFixed(1) : '?';
            toast.error(`${t('storage.quotaExceeded')} (${usedGB} / ${quotaGB} GB)`);
            queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
            throw err; // bubble up to stop remaining batches
          }
          setQueue((q) =>
            q.map((item) => (batchIds.includes(item.id) ? { ...item, error: true } : item)),
          );
        }
      };

      // Run PARALLEL_BATCHES concurrent uploads at a time
      try {
        for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
          if (controller.signal.aborted) break;
          await Promise.all(batches.slice(i, i + PARALLEL_BATCHES).map(uploadBatch));
        }
      } catch {
        // quota exceeded — already toasted inside uploadBatch
      }

      const wasCancelled = controller.signal.aborted;
      activeControllersRef.current.delete(controller);
      // Only clear the queue once all parallel sessions are done
      if (!wasCancelled && activeControllersRef.current.size === 0) {
        scheduleClear();
      }
    },
    [galleryId, onUploadComplete, queryClient, scheduleClear, t],
  );

  const isUploading = queue.some((item) => !item.done && !item.error && !item.cancelled);

  return { queue, dragging, setDragging, inputRef, handleFiles, cancelUpload, isUploading, uploadStats };
}
