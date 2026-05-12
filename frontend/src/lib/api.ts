import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const S3_PUBLIC_URL = (import.meta.env.VITE_S3_PUBLIC_URL || '').replace(/\/$/, '');

/**
 * Resolve a stored image/video path to a fully-qualified URL.
 *
 * If VITE_S3_PUBLIC_URL is set (public bucket), raw S3 keys and full S3 URLs
 * are served directly from the bucket — faster, no backend proxy hop.
 * Without it, all S3 paths go through /api/media/ (private bucket proxy).
 *
 * Handled formats:
 *  1. Raw S3 key  — "admins/<id>/file.jpg" or "face-references/..."
 *  2. Full S3 URL — any provider (AWS, Wasabi, R2, MinIO, …)
 *  3. Local /uploads/... path (dev, S3 disabled) — prepend backend base URL
 *  4. Unrecognised https:// — returned as-is
 */
export const getImageUrl = (path: string): string => {
  if (!path) return '';
  // Local static file (dev, S3 not configured)
  if (path.startsWith('/')) return `${API_BASE}${path}`;
  // Full S3 URL — extract the raw key then re-resolve
  if (path.startsWith('https://')) {
    for (const prefix of ['/admins/', '/face-references/']) {
      const idx = path.indexOf(prefix);
      if (idx !== -1) {
        const key = path.slice(idx + 1);
        return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : `${API_BASE}/api/media/${key}`;
      }
    }
    return path;
  }
  // Raw S3 key (e.g. "admins/<id>/file.jpg" or "face-references/...")
  return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${path}` : `${API_BASE}/api/media/${path}`;
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
