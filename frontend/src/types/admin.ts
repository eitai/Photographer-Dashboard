export interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  sessionType: 'family' | 'maternity' | 'newborn' | 'branding' | 'landscape';
  status: string;
  notes?: string;
  eventDate?: string;
  createdAt?: string;
}

export interface AdminRecord {
  id: string;
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
  clientId: string | { _id: string; name?: string; email?: string; phone?: string };
  adminId?: string;
  token?: string;
  status: string;
  isActive?: boolean;
  isDelivery?: boolean;
  deliveryOf?: string;
  maxSelections?: number;
  headerMessage?: string;
  expiresAt?: string | null;
  sessionType?: string;
  selectionEnabled?: boolean;
  videos?: GalleryVideo[];
}

export interface GalleryImage {
  _id: string;
  path: string;
  thumbnailPath?: string;
  previewPath?: string;
  originalName: string;
  beforePath?: string;
  sortOrder?: number;
  folderIds?: string[];
}
