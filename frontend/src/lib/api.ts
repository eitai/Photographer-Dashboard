import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Resolve a stored image/video path to a fully-qualified URL.
 *
 * Three formats are handled:
 *
 *  1. S3 key  (new format)  — "admins/<id>/file.jpg"
 *     → routed through /api/media/<key> which generates a presigned URL
 *       and redirects 302. Transparent to <img>, <video>, fetch, etc.
 *
 *  2. Legacy full S3 URL — "https://bucket.s3.amazonaws.com/admins/..."
 *     → key is extracted from the URL and routed the same way.
 *
 *  3. Local /uploads/... path (dev with S3 disabled)
 *     → backend URL is prepended; served directly as a static file.
 */
export const getImageUrl = (path: string): string => {
  if (!path) return '';
  // Local static file (dev, S3 not configured)
  if (path.startsWith('/')) return `${API_BASE}${path}`;
  // Legacy full S3 URL — extract key after ".amazonaws.com/"
  if (path.startsWith('https://') && path.includes('.amazonaws.com/')) {
    const key = path.split('.amazonaws.com/').pop();
    if (key) return `${API_BASE}/api/media/${key}`;
  }
  // New format: raw S3 key (e.g. "admins/<id>/file.jpg")
  return `${API_BASE}/api/media/${path}`;
};

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
  // Required for the browser to send/receive httpOnly cookies cross-origin
  withCredentials: true,
});

// Auth is cookie-first (httpOnly session cookie set by the server).
// koral_admin_token and koral_admin_user are UI-only cache and must both
// be cleared so the next render does not flash a stale user name.
// Use replace() so the login page is not on the history stack —
// pressing Back must not return to a protected route.
function clearAuthAndRedirect() {
  localStorage.removeItem('koral_admin_token');
  localStorage.removeItem('koral_admin_user');
  window.location.replace('/admin');
}

// Handle 401 — clear local user state and redirect to login.
// Skip cancelled requests: when queryClient.clear() aborts an in-flight /auth/me
// during logout, we don't want that stale 401 to interrupt a concurrent login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ERR_CANCELED') return Promise.reject(err);
    if (err.response?.status === 401) {
      clearAuthAndRedirect();
    }
    return Promise.reject(err);
  }
);

// ---- Auth ----
// Accepts the AbortSignal from React Query so the request is properly cancelled
// when queryClient.clear() is called (e.g. on logout).
export const verifyAuth = ({ signal }: { signal: AbortSignal }): Promise<{ admin: import('@/store/authStore').AdminUser }> =>
  api.get('/auth/me', { signal }).then((r) => r.data);

// ---- Storage ----
export const getMyStorage = (): Promise<import('@/types/admin').StorageStats> =>
  api.get('/storage/me').then((r) => r.data);

export const getAdminStorage = (adminId: string): Promise<import('@/types/admin').StorageStats> =>
  api.get(`/admins/${adminId}/storage`).then((r) => r.data);

export const setAdminQuota = (adminId: string, quotaGB: number): Promise<{ adminId: string; quotaBytes: number; quotaGB: number }> =>
  api.patch(`/admins/${adminId}/quota`, { quotaGB }).then((r) => r.data);

// ---- Face Reference ----

export interface FaceReferenceStatus {
  hasReference: boolean;
  imagePath?: string;
  modelVersion?: string;
  updatedAt?: string;
}

export interface FaceReferenceUploadResult {
  referenceId: string;
  clientId: string;
}

export const getClientFaceReference = (clientId: string): Promise<FaceReferenceStatus> =>
  api.get(`/clients/${clientId}/face-reference`).then((r) => r.data);

export const uploadClientFaceReference = (clientId: string, file: File): Promise<FaceReferenceUploadResult> => {
  const formData = new FormData();
  formData.append('reference', file);
  return api
    .post(`/clients/${clientId}/face-reference`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const deleteClientFaceReference = (clientId: string): Promise<void> =>
  api.delete(`/clients/${clientId}/face-reference`).then((r) => r.data);

export interface TaggedImagesPage {
  images: import('@/types/admin').GalleryImage[];
  total: number;
  page: number;
  totalPages: number;
}

export const getClientTaggedImages = (clientId: string, page = 1, limit = 50): Promise<TaggedImagesPage> =>
  api.get(`/clients/${clientId}/tagged-images`, { params: { page, limit } }).then((r) => r.data);

// ---- Face Recognition Jobs ----

export type FaceRecognitionJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface FaceRecognitionJob {
  id: string;
  galleryId: string;
  totalImages: number;
  processed: number;
  matched: number;
  status: FaceRecognitionJobStatus;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
}

export const getFaceRecognitionStatus = (galleryId: string): Promise<FaceRecognitionJob> =>
  api.get(`/galleries/${galleryId}/face-recognition/status`).then((r) => r.data);

export const runFaceRecognition = (galleryId: string): Promise<{ jobId: string }> =>
  api.post(`/galleries/${galleryId}/face-recognition/run`).then((r) => r.data);

// ---- Face Tags ----

export interface FaceTag {
  id: string;
  clientId: string;
  clientName?: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  status: string;
  confirmedByAdmin: boolean;
}

export const getImageFaceTags = (galleryId: string, imageId: string): Promise<FaceTag[]> =>
  api.get(`/galleries/${galleryId}/images/${imageId}/face-tags`).then((r) => r.data);

export const updateFaceTag = (
  galleryId: string,
  imageId: string,
  tagId: string,
  data: { confirmed?: boolean; clientId?: string },
): Promise<FaceTag> =>
  api.patch(`/galleries/${galleryId}/images/${imageId}/face-tags/${tagId}`, data).then((r) => r.data);

export const deleteFaceTag = (galleryId: string, imageId: string, tagId: string): Promise<void> =>
  api.delete(`/galleries/${galleryId}/images/${imageId}/face-tags/${tagId}`).then((r) => r.data);

// ---- Face Groups (filter strip) ----

export interface FaceGroup {
  groupKey: string;
  status: 'matched' | 'unmatched';
  clientId: string | null;
  clientName?: string | null;
  referencePhotoPath?: string | null;
  repBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  repThumbnailPath?: string | null;
  faceCropPath?: string | null;
  photoCount: number;
  imageIds: string[];
}

export const getGalleryFaceGroups = (galleryId: string): Promise<FaceGroup[]> =>
  api.get(`/galleries/${galleryId}/face-recognition/faces`).then((r) => r.data);

export const getGalleryFaceGroupsPublic = (galleryId: string, token: string): Promise<FaceGroup[]> =>
  api.get(`/galleries/${galleryId}/face-recognition/faces`, { params: { token } }).then((r) => r.data);

export default api;
