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

const MAX_IMAGE_SIZE = 40 * 1024 * 1024; // 40 MB per file
const MAX_BATCH_BYTES = 50 * 1024 * 1024; // 50 MB per request (Cloudflare free plan cap is 100 MB — stay well under)
const PARALLEL_BATCHES = 2;              // concurrent requests

export function useGalleryUpload(galleryId: string | undefined, onUploadComplete: () => void) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClear = useCallback(() => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    clearTimeoutRef.current = setTimeout(() => {
      clearTimeoutRef.current = null;
      setQueue([]);
    }, 1500);
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

        // Easing timer: fast at first, slows toward 90% — reflects upload + server processing time
        let pct = 0;
        const timer = setInterval(() => {
          pct = Math.min(pct + Math.max(0.5, (90 - pct) * 0.04), 90);
          setQueue((q) =>
            q.map((item) =>
              batchIds.includes(item.id) && !item.done && !item.error && !item.cancelled
                ? { ...item, progress: Math.round(pct) }
                : item,
            ),
          );
        }, 150);

        try {
          await api.post(`/galleries/${galleryId}/images`, formData, {
            headers: { 'Content-Type': undefined },
            signal: controller.signal,
          });
          clearInterval(timer);
          setQueue((q) =>
            q.map((item) => (batchIds.includes(item.id) ? { ...item, progress: 100, done: true } : item)),
          );
          queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
          onUploadComplete();
        } catch (err: any) {
          clearInterval(timer);
          if (err?.code === 'ERR_CANCELED' || controller.signal.aborted) {
            // Cancelled — queue state already handled by cancelUpload()
            return;
          }
          if (err?.response?.status === 413 && err?.response?.data?.code === 'QUOTA_EXCEEDED') {
            toast.error(t('storage.quotaExceeded'));
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

  return { queue, dragging, setDragging, inputRef, handleFiles, cancelUpload, isUploading };
}
