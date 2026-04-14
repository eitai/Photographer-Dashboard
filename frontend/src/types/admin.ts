export interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  sessionType: 'family' | 'maternity' | 'newborn' | 'branding' | 'landscape';
  status: string;
  notes?: string;
  createdAt?: string;
}

export interface AdminRecord {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'superadmin';
  username?: string | null;
  studioName?: string | null;
  createdAt: string;
  storageQuotaBytes: number;
  storageUsedBytes: number;
}

export interface StorageStats {
  adminId: string;
  usedBytes: number;
  quotaBytes: number | null;
  usedGB: number;
  quotaGB: number | null;
  percentUsed: number;
  unlimited: boolean;
}

export interface AdminSettings {
  bio: string;
  heroImagePath: string;
  profileImagePath: string;
  phone: string;
  instagramHandle: string;
  facebookUrl: string;
  heroSubtitle: string;
  contactEmail: string;
}

export interface GalleryVideo {
  path: string;
  filename: string;
  originalName: string;
}

export interface GalleryDetail {
  _id: string;
  name: string;
  clientName: string;
  clientId: string | { _id: string };
  status: string;
  videos?: GalleryVideo[];
}

export interface GalleryImage {
  _id: string;
  path: string;
  thumbnailPath?: string;
  originalName: string;
  beforePath?: string;
}
