import api from '@/lib/api';
import type { GalleryData, GalleryFolder, GallerySubmission } from '@/types/gallery';

export const listGalleries = (): Promise<GalleryData[]> => api.get('/galleries').then((r) => r.data);

export const updateGallery = (id: string, data: Partial<GalleryData>): Promise<GalleryData> =>
  api.put(`/galleries/${id}`, data).then((r) => r.data);

export const fetchGalleries = (clientId: string): Promise<GalleryData[]> =>
  api.get(`/galleries?clientId=${clientId}`).then((r) => r.data);

export const fetchSubmissions = (galleryId: string): Promise<GallerySubmission[]> =>
  api.get(`/galleries/${galleryId}/submissions`).then((r) => r.data);

export const createGallery = (data: { name: string; headerMessage: string; maxSelections: number; clientId: string; clientName: string; expiresAt?: string | null; sessionType?: string; selectionEnabled?: boolean }) =>
  api.post('/galleries', data).then((r) => r.data);

export const listFolders = (galleryId: string): Promise<GalleryFolder[]> =>
  api.get(`/galleries/${galleryId}/folders`).then((r) => r.data);

export const createFolder = (galleryId: string, name: string): Promise<GalleryFolder> =>
  api.post(`/galleries/${galleryId}/folders`, { name }).then((r) => r.data);

export const renameFolder = (galleryId: string, folderId: string, name: string): Promise<GalleryFolder> =>
  api.patch(`/galleries/${galleryId}/folders/${folderId}`, { name }).then((r) => r.data);

export const deleteFolder = (galleryId: string, folderId: string): Promise<void> =>
  api.delete(`/galleries/${galleryId}/folders/${folderId}`).then((r) => r.data);

export const createDelivery = (galleryId: string, data: { headerMessage: string; name?: string }) =>
  api.post(`/galleries/${galleryId}/delivery`, data).then((r) => r.data);

export const resendGalleryEmail = (galleryId: string) =>
  api.post(`/galleries/${galleryId}/resend-email`).then((r) => r.data);

export const sendGallerySms = (galleryId: string) =>
  api.post(`/galleries/${galleryId}/send-sms`).then((r) => r.data);

export const reactivateGallery = (galleryId: string): Promise<GalleryData> =>
  api.post(`/galleries/${galleryId}/reactivate`).then((r) => r.data);

export const removeGallery = (galleryId: string) =>
  api.delete(`/galleries/${galleryId}`);

export const removeSubmission = (galleryId: string, submissionId: string) =>
  api.delete(`/galleries/${galleryId}/submissions/${submissionId}`);

export const removeSubmissionImage = (galleryId: string, submissionId: string, imageId: string) =>
  api.delete(`/galleries/${galleryId}/submissions/${submissionId}/images/${imageId}`);

export const uploadGalleryVideo = (galleryId: string, file: File) => {
  const form = new FormData();
  form.append('video', file);
  return api.post(`/galleries/${galleryId}/video`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const deleteGalleryVideo = (galleryId: string) =>
  api.delete(`/galleries/${galleryId}/video`).then((r) => r.data);
