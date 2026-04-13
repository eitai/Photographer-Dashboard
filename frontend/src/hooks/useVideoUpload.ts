import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { GalleryDetail, GalleryVideo } from '@/types/admin';
import { queryKeys } from '@/hooks/useQueries';

export interface VideoQueueItem {
  id: string;
  name: string;
  progress: number;
  done: boolean;
  error: boolean;
  cancelled: boolean;
}

export const useVideoUpload = (
  id: string | undefined,
  setGallery: React.Dispatch<React.SetStateAction<GalleryDetail | null>>,
) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoQueue, setVideoQueue] = useState<VideoQueueItem[]>([]);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const updateItem = (itemId: string, patch: Partial<VideoQueueItem>) =>
    setVideoQueue((q) => q.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));

  // Ticks simulated progress up to 90%, then waits for real completion
  const startSimulatedProgress = (itemId: string) => {
    let current = 0;
    const interval = setInterval(() => {
      current = Math.min(current + Math.random() * 4 + 1, 90);
      updateItem(itemId, { progress: Math.round(current) });
    }, 300);
    intervalsRef.current.set(itemId, interval);
  };

  const stopSimulatedProgress = (itemId: string) => {
    const interval = intervalsRef.current.get(itemId);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(itemId);
    }
  };

  const cancelUpload = (itemId: string) => {
    stopSimulatedProgress(itemId);
    controllersRef.current.get(itemId)?.abort();
    controllersRef.current.delete(itemId);
  };

  const handleVideoUpload = async (files: FileList) => {
    const validFiles: File[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('video/')) {
        toast.error(t('admin.gallery.video_invalid_type').replace('{{name}}', f.name));
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    const items: VideoQueueItem[] = validFiles.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      progress: 0,
      done: false,
      error: false,
      cancelled: false,
    }));
    setVideoQueue((q) => [...q, ...items]);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const item = items[i];

      const controller = new AbortController();
      controllersRef.current.set(item.id, controller);

      const form = new FormData();
      form.append('videos', file);

      startSimulatedProgress(item.id);

      try {
        const r = await api.post(`/galleries/${id}/video`, form, {
          headers: { 'Content-Type': undefined },
          signal: controller.signal,
        });
        stopSimulatedProgress(item.id);
        controllersRef.current.delete(item.id);
        updateItem(item.id, { progress: 100, done: true });
        queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
        setGallery((g) => g ? { ...g, videos: r.data.videos as GalleryVideo[] } : g);
      } catch (err: any) {
        stopSimulatedProgress(item.id);
        controllersRef.current.delete(item.id);

        if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError' || err?.name === 'CanceledError') {
          updateItem(item.id, { cancelled: true });
          setTimeout(() => setVideoQueue((q) => q.filter((it) => it.id !== item.id)), 1500);
          continue;
        }

        if (err?.response?.status === 413 && err?.response?.data?.code === 'QUOTA_EXCEEDED') {
          toast.error(t('storage.quotaExceeded'));
          queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
          const pendingIds = items.slice(i).map((it) => it.id);
          setVideoQueue((q) => q.filter((it) => !pendingIds.includes(it.id)));
          return;
        }

        updateItem(item.id, { error: true });
        toast.error(t('admin.gallery.video_error'));
      }
    }

    setTimeout(() => {
      setVideoQueue((q) => q.filter((item) => !item.done));
    }, 2500);
  };

  const handleVideoDelete = async (filename: string) => {
    setDeletingFilename(filename);
    try {
      await api.delete(`/galleries/${id}/video/${filename}`);
      setGallery((g) => g ? { ...g, videos: (g.videos ?? []).filter((v) => v.filename !== filename) } : g);
      queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
      toast.success(t('admin.gallery.video_deleted'));
    } catch {
      toast.error(t('admin.gallery.video_error'));
    } finally {
      setDeletingFilename(null);
    }
  };

  return { videoInputRef, videoQueue, deletingFilename, handleVideoUpload, handleVideoDelete, cancelUpload };
};
