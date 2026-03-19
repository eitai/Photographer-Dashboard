import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { GalleryDetail, GalleryVideo } from '@/types/admin';

export interface VideoQueueItem {
  id: string;
  name: string;
  progress: number;
  done: boolean;
  error: boolean;
}

export const useVideoUpload = (
  id: string | undefined,
  setGallery: React.Dispatch<React.SetStateAction<GalleryDetail | null>>,
) => {
  const { t } = useI18n();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoQueue, setVideoQueue] = useState<VideoQueueItem[]>([]);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const updateItem = (itemId: string, patch: Partial<VideoQueueItem>) =>
    setVideoQueue((q) => q.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));

  const handleVideoUpload = async (files: FileList) => {
    const items: VideoQueueItem[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      progress: 0,
      done: false,
      error: false,
    }));
    setVideoQueue((q) => [...q, ...items]);

    // Upload one at a time so large files don't saturate the connection
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const item = items[i];
      const form = new FormData();
      form.append('videos', file);
      try {
        const r = await api.post(`/galleries/${id}/video`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            const pct = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
            updateItem(item.id, { progress: pct });
          },
        });
        updateItem(item.id, { progress: 100, done: true });
        // Merge the new videos from the response into gallery state
        setGallery((g) => g ? { ...g, videos: r.data.videos as GalleryVideo[] } : g);
      } catch {
        updateItem(item.id, { error: true });
        toast.error(t('admin.gallery.video_error'));
      }
    }

    // Clear completed items after a short delay
    setTimeout(() => {
      setVideoQueue((q) => q.filter((item) => !item.done));
    }, 2500);
  };

  const handleVideoDelete = async (filename: string) => {
    setDeletingFilename(filename);
    try {
      await api.delete(`/galleries/${id}/video/${filename}`);
      setGallery((g) => g ? { ...g, videos: (g.videos ?? []).filter((v) => v.filename !== filename) } : g);
      toast.success(t('admin.gallery.video_deleted'));
    } catch {
      toast.error(t('admin.gallery.video_error'));
    } finally {
      setDeletingFilename(null);
    }
  };

  return { videoInputRef, videoQueue, deletingFilename, handleVideoUpload, handleVideoDelete };
};
