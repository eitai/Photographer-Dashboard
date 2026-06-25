/**
 * @koral/api — Shared typed Axios client
 *
 * Reads EXPO_PUBLIC_API_URL from the environment.
 * JWT is persisted in expo-secure-store (async).
 * 401 responses emit a "logout" event via mitt so any subscriber can
 * react without coupling to navigation APIs.
 */

import axios, { type InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import mitt from 'mitt';

import type { Admin, Client, Gallery, GalleryImage, BlogPost } from '@koral/types';

// ---------------------------------------------------------------------------
// Event bus — 401 responses fire "logout" so the auth store can react
// ---------------------------------------------------------------------------

type BusEvents = {
  logout: void;
};

export const eventBus = mitt<BusEvents>();

// ---------------------------------------------------------------------------
// Secure-store key and token helpers
// Platform-aware: SecureStore on native, localStorage on web
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'koral_auth_token';

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT if one is stored
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — emit logout on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      eventBus.emit('logout');
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Helper — unwrap .data from AxiosResponse
// ---------------------------------------------------------------------------

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<T>(url, { params });
  return res.data;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.post<T>(url, body);
  return res.data;
}

async function put<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.put<T>(url, body);
  return res.data;
}

async function del<T>(url: string): Promise<T> {
  const res = await apiClient.delete<T>(url);
  return res.data;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginResponse {
  token: string;
  admin: Admin;
}

function normalizeAdmin(raw: Record<string, unknown>): Admin {
  return { ...raw, _id: raw._id ?? raw.id } as unknown as Admin;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return post<{ token: string; admin: Record<string, unknown> }>('/api/auth/login', { email, password })
    .then(({ token, admin }) => ({ token, admin: normalizeAdmin(admin) }));
}

export function getMe(): Promise<Admin> {
  return get<{ admin: Record<string, unknown> }>('/api/auth/me')
    .then(({ admin }) => normalizeAdmin(admin));
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export function getClients(): Promise<Client[]> {
  return get<Client[]>('/api/clients');
}

export function getClient(id: string): Promise<Client> {
  return get<Client>(`/api/clients/${id}`);
}

export function createClient(data: Partial<Client>): Promise<Client> {
  return post<Client>('/api/clients', data);
}

export function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  return put<Client>(`/api/clients/${id}`, data);
}

export function deleteClient(id: string): Promise<void> {
  return del<void>(`/api/clients/${id}`);
}

// ---------------------------------------------------------------------------
// Galleries
// ---------------------------------------------------------------------------
// The backend schema uses `name` for the gallery title; the mobile type uses
// `title`. These helpers normalise the mismatch transparently so no screen
// code needs to know about it.
// The backend also stores images in a separate GalleryImage collection; we
// fetch and embed them in `getGallery` so screens can use `gallery.images`.

type RawGallery = Record<string, unknown>;

function normalizeImage(img: Record<string, unknown>): GalleryImage {
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';
  const path = img.path as string | undefined;
  return {
    ...(img as unknown as GalleryImage),
    url: path ? `${baseURL}${path}` : (img.url as string) ?? '',
  };
}

function normalizeGallery(raw: RawGallery): Gallery {
  const { name, images, ...rest } = raw;
  return {
    ...rest,
    title: (name ?? rest.title) as string,
    images: ((images as Record<string, unknown>[]) ?? []).map(normalizeImage),
  } as Gallery;
}

function toBackendGallery(data: Partial<Gallery>): RawGallery {
  const { title, ...rest } = data;
  const payload: RawGallery = { ...rest };
  if (title !== undefined) payload.name = title;
  return payload;
}

export function getGalleries(): Promise<Gallery[]> {
  return get<RawGallery[]>('/api/galleries').then((arr) =>
    arr.map((g) => normalizeGallery({ ...g, images: (g.images as GalleryImage[]) ?? [] })),
  );
}

export function getGallery(id: string): Promise<Gallery> {
  return Promise.all([
    get<RawGallery>(`/api/galleries/${id}`),
    get<GalleryImage[]>(`/api/galleries/${id}/images`),
  ]).then(([gallery, images]) => normalizeGallery({ ...gallery, images }));
}

export function createGallery(data: Partial<Gallery>): Promise<Gallery> {
  return post<RawGallery>('/api/galleries', toBackendGallery(data)).then(normalizeGallery);
}

export function updateGallery(id: string, data: Partial<Gallery>): Promise<Gallery> {
  return put<RawGallery>(`/api/galleries/${id}`, toBackendGallery(data)).then(normalizeGallery);
}

export function deleteGallery(id: string): Promise<void> {
  return del<void>(`/api/galleries/${id}`);
}

export function resendGalleryEmail(id: string): Promise<{ message: string }> {
  return post<{ message: string }>(`/api/galleries/${id}/resend-email`);
}

export function createDeliveryGallery(
  galleryId: string,
  data: { name?: string; headerMessage?: string },
): Promise<Gallery> {
  return post<RawGallery>(`/api/galleries/${galleryId}/delivery`, data).then(normalizeGallery);
}

export async function uploadImages(galleryId: string, formData: FormData): Promise<void> {
  // On web, do NOT set Content-Type — the browser sets it automatically with the
  // correct multipart boundary. On native, React Native's networking layer handles
  // FormData serialisation and needs the explicit header.
  const headers = Platform.OS === 'web'
    ? {}
    : { 'Content-Type': 'multipart/form-data' };
  await apiClient.post(`/api/galleries/${galleryId}/images`, formData, { headers });
}

export function deleteImage(galleryId: string, imageId: string): Promise<void> {
  return del<void>(`/api/galleries/${galleryId}/images/${imageId}`);
}

// ---------------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------------

export function getSelections(): Promise<unknown[]> {
  return get<unknown[]>('/api/selections');
}

export function getSelection(galleryId: string): Promise<unknown> {
  return get<unknown>(`/api/selections/${galleryId}`);
}

export function deleteSubmission(galleryId: string, submissionId: string): Promise<void> {
  return del<void>(`/api/galleries/${galleryId}/submissions/${submissionId}`);
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

export function getBlogPosts(): Promise<BlogPost[]> {
  return get<BlogPost[]>('/api/blog');
}

export function getBlogPost(id: string): Promise<BlogPost> {
  return get<BlogPost>(`/api/blog/${id}`);
}

export function createBlogPost(data: Partial<BlogPost>): Promise<BlogPost> {
  return post<BlogPost>('/api/blog', data);
}

export function updateBlogPost(id: string, data: Partial<BlogPost>): Promise<BlogPost> {
  return put<BlogPost>(`/api/blog/${id}`, data);
}

export function deleteBlogPost(id: string): Promise<void> {
  return del<void>(`/api/blog/${id}`);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SiteSettings {
  featuredImages: GalleryImageRef[];
}

export interface GalleryImageRef {
  _id: string;
  filename: string;
  url: string;
}

export function getSettings(): Promise<SiteSettings> {
  return get<SiteSettings>('/api/settings');
}

export function updateFeaturedImages(imageIds: string[]): Promise<SiteSettings> {
  return put<SiteSettings>('/api/settings/featured', { imageIds });
}

// ---------------------------------------------------------------------------
// Auth — password change
// ---------------------------------------------------------------------------

export interface ChangePasswordPayload {
  current: string;
  next: string;
}

export function changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  return put<{ message: string }>('/api/auth/password', payload);
}

// ---------------------------------------------------------------------------
// Admins (superadmin only)
// ---------------------------------------------------------------------------

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  username?: string;
  studioName?: string;
  role: 'admin' | 'superadmin';
  createdAt: string;
}

export interface CreateAdminPayload {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'superadmin';
  username?: string;
  studioName?: string;
}

export function getAdmins(): Promise<AdminUser[]> {
  return get<AdminUser[]>('/api/admins');
}

export function createAdmin(data: CreateAdminPayload): Promise<AdminUser> {
  return post<AdminUser>('/api/admins', data);
}

export function deleteAdmin(id: string): Promise<void> {
  return del<void>(`/api/admins/${id}`);
}
