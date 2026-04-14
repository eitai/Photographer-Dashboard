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

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
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

      const newItems: UploadFile[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        progress: 0,
        done: false,
        error: false,
      }));
      setQueue((q) => [...q, ...newItems]);

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
        try {
          await api.post(`/galleries/${galleryId}/images`, formData, {
            headers: { 'Content-Type': undefined },
            onUploadProgress: (ev) => {
              const pct = Math.round((ev.progress ?? 0) * 100);
              setQueue((q) =>
                q.map((item) => (batchIds.includes(item.id) ? { ...item, progress: pct } : item)),
              );
            },
          });
          setQueue((q) =>
            q.map((item) => (batchIds.includes(item.id) ? { ...item, progress: 100, done: true } : item)),
          );
          queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
          onUploadComplete();
        } catch (err) {
          if ((err as any)?.response?.status === 413 && (err as any)?.response?.data?.code === 'QUOTA_EXCEEDED') {
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
          await Promise.all(batches.slice(i, i + PARALLEL_BATCHES).map(uploadBatch));
        }
      } catch {
        // quota exceeded — already toasted inside uploadBatch
      }

      setTimeout(() => setQueue([]), 1500);
    },
    [galleryId, onUploadComplete, queryClient, t],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return { queue, dragging, setDragging, inputRef, handleFiles, onDrop };
}
