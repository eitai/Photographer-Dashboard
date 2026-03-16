import { useState, useRef, useCallback } from 'react';
import api from '@/lib/api';

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  done: boolean;
  error: boolean;
}

export function useGalleryUpload(galleryId: string | undefined, onUploadComplete: () => void) {
  const [queue, setQueue] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
      const newItems: UploadFile[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        progress: 0,
        done: false,
        error: false,
      }));
      setQueue((q) => [...q, ...newItems]);

      const batches: UploadFile[][] = [];
      for (let i = 0; i < newItems.length; i += 20) batches.push(newItems.slice(i, i + 20));

      for (const batch of batches) {
        const batchIds = batch.map((b) => b.id);
        const formData = new FormData();
        batch.forEach((b) => formData.append('images', b.file));
        try {
          await api.post(`/galleries/${galleryId}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (ev) => {
              const pct = Math.round((ev.loaded / (ev.total || 1)) * 100);
              setQueue((q) =>
                q.map((item) => (batchIds.includes(item.id) ? { ...item, progress: pct } : item)),
              );
            },
          });
          setQueue((q) =>
            q.map((item) => (batchIds.includes(item.id) ? { ...item, progress: 100, done: true } : item)),
          );
          onUploadComplete();
        } catch {
          setQueue((q) =>
            q.map((item) => (batchIds.includes(item.id) ? { ...item, error: true } : item)),
          );
        }
      }

      setTimeout(() => setQueue([]), 1500);
    },
    [galleryId, onUploadComplete],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return { queue, dragging, setDragging, inputRef, handleFiles, onDrop };
}
