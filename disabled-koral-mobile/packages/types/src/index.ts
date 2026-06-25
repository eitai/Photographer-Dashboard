// @koral/types — Shared domain types
// TODO: Mirror types from the Express API models (Gallery, Client, BlogPost, etc.)

export interface Admin {
  _id: string;
  name: string;
  email: string;
  username: string;
  studioName?: string;
  role: 'admin' | 'superadmin';
}

export type SessionType =
  | 'family'
  | 'maternity'
  | 'newborn'
  | 'branding'
  | 'landscape';

export interface Client {
  _id: string;
  adminId: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  sessionType?: SessionType;
  createdAt: string;
}

export type GalleryStatus =
  | 'gallery_sent'
  | 'viewed'
  | 'selection_submitted'
  | 'in_editing'
  | 'delivered';

export interface Gallery {
  _id: string;
  adminId: string;
  clientId: string;
  title: string;
  token?: string;
  status: GalleryStatus;
  images: GalleryImage[];
  headerMessage?: string;
  maxSelections?: number;
  isDelivery?: boolean;
  deliveryOf?: string;
  createdAt: string;
}

export interface GalleryImage {
  _id: string;
  filename: string;
  url: string;
  path?: string;
  thumbnailPath?: string;
  selected?: boolean;
}

export interface BlogPost {
  _id: string;
  adminId: string;
  title: string;
  slug: string;
  content: string;
  published?: boolean;
  /** ISO date string — present means published, absent means draft */
  publishedAt?: string;
  createdAt: string;
}
