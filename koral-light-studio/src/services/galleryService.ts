import api from '@/lib/api';

export const listGalleries = () => api.get('/galleries').then((r) => r.data);

export const updateGallery = (id: string, data: any) => api.put(`/galleries/${id}`, data).then((r) => r.data);

export const fetchGalleries = (clientId: string) =>
  api.get(`/galleries?clientId=${clientId}`).then((r) => r.data);

export const fetchSubmissions = (galleryId: string) =>
  api.get(`/galleries/${galleryId}/submissions`).then((r) => r.data);

export const createGallery = (data: { name: string; headerMessage: string; maxSelections: number; clientId: string; clientName: string }) =>
  api.post('/galleries', data).then((r) => r.data);

export const createDelivery = (galleryId: string, data: { headerMessage: string; name?: string }) =>
  api.post(`/galleries/${galleryId}/delivery`, data).then((r) => r.data);

export const resendGalleryEmail = (galleryId: string) =>
  api.post(`/galleries/${galleryId}/resend-email`).then((r) => r.data);

export const removeGallery = (galleryId: string) =>
  api.delete(`/galleries/${galleryId}`);

export const removeSubmission = (galleryId: string, submissionId: string) =>
  api.delete(`/galleries/${galleryId}/submissions/${submissionId}`);

export const removeSubmissionImage = (galleryId: string, submissionId: string, imageId: string) =>
  api.delete(`/galleries/${galleryId}/submissions/${submissionId}/images/${imageId}`);
