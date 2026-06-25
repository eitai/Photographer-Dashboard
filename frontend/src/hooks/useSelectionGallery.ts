import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { downloadZip } from '@/lib/downloadZip';
import type { GalleryData, GalleryImage } from '@/types/gallery';

const VIRTUALIZATION_THRESHOLD = 500;

export function useSelectionGallery(
  gallery: GalleryData,
  images: GalleryImage[],
  filteredImageIds?: Set<string> | null,
) {
  const selectionEnabled = gallery.selectionEnabled !== false;
  const alreadySubmitted =
    gallery.status === 'selection_submitted' ||
    gallery.status === 'in_editing' ||
    gallery.status === 'delivered';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (gallery.previousSelectionIds?.length) {
      return new Set(gallery.previousSelectionIds);
    }
    const saved = sessionStorage.getItem(`selections_${gallery._id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('gallery_session');
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem('gallery_session', id);
    return id;
  });

  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState<{ done: number; total: number } | null>(null);
  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === 'undefined') return 3;
    return window.innerWidth < 640 ? 2 : 3;
  });

  useEffect(() => {
    const onResize = () => setColumnCount(window.innerWidth < 640 ? 2 : 3);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const hasLimit = selectionEnabled && gallery.maxSelections > 0;
  const atMax = hasLimit && selectedIds.size >= gallery.maxSelections;

  const visibleImages = (() => {
    let imgs = activeFolderId
      ? images.filter((img) => img.folderIds?.includes(activeFolderId))
      : images;
    if (filteredImageIds != null) imgs = imgs.filter((img) => filteredImageIds.has(img._id));
    return imgs;
  })();

  const isVirtualized = visibleImages.length > VIRTUALIZATION_THRESHOLD;

  const toggleSelect = (imageId: string) => {
    setSelectedIds((prev) => {
      if (!prev.has(imageId) && atMax) return prev;
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId); else next.add(imageId);
      sessionStorage.setItem(`selections_${gallery._id}`, JSON.stringify([...next]));
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    const filteredComments = Object.fromEntries(
      Object.entries(imageComments).filter(([id, c]) => selectedIds.has(id) && c.trim())
    );
    await api.post(`/galleries/${gallery._id}/submit`, {
      sessionId,
      selectedImageIds: Array.from(selectedIds),
      imageComments: filteredComments,
      heroImageId: heroId && selectedIds.has(heroId) ? heroId : undefined,
    });
    localStorage.setItem(`submitted_${gallery._id}`, 'true');
    setSubmitted(true);
  };

  const handleDownload = (path: string, filename: string) => {
    const link = document.createElement('a');
    link.href = path;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    if (!images.length || isDownloadingAll) return;
    setIsDownloadingAll(true);
    setDownloadAllProgress({ done: 0, total: images.length });
    try {
      await downloadZip(
        images.map((img) => ({ _id: img._id, path: img.path, filename: img.filename, originalName: img.originalName })),
        gallery.name || 'photos',
        gallery.name || 'photos',
        (done, total) => setDownloadAllProgress({ done, total }),
      );
    } finally {
      setIsDownloadingAll(false);
      setDownloadAllProgress(null);
    }
  };

  const handleDownloadSelected = async () => {
    const selectedImages = images.filter((img) => selectedIds.has(img._id));
    if (!selectedImages.length || isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress({ done: 0, total: selectedImages.length });
    try {
      await downloadZip(
        selectedImages.map((img) => ({ _id: img._id, path: img.path, filename: img.filename, originalName: img.originalName })),
        gallery.name || 'photos',
        gallery.name || 'photos',
        (done, total) => setDownloadProgress({ done, total }),
      );
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  return {
    // state
    selectedIds, submitted, lightboxIndex, heroId, imageComments, activeCommentId, activeFolderId,
    isDownloading, downloadProgress, isDownloadingAll, downloadAllProgress, columnCount,
    // derived
    selectionEnabled, hasLimit, atMax, visibleImages, isVirtualized,
    // setters
    setLightboxIndex, setHeroId, setActiveCommentId, setActiveFolderId, setImageComments,
    // handlers
    toggleSelect, handleSubmit, handleDownload, handleDownloadAll, handleDownloadSelected,
  };
}
