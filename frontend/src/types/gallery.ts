export interface GalleryImage {
  _id: string;
  filename: string;
  originalName: string;
  path: string;
  thumbnailPath?: string;
  beforePath?: string;
  sortOrder: number;
}

export interface GalleryData {
  _id: string;
  name: string;
  clientName: string;
  clientId: string;
  token: string;
  headerMessage: string;
  maxSelections: number;
  isDelivery: boolean;
  isActive: boolean;
  deliveryOf?: string;
  lastEmailSentAt?: string;
  status: 'gallery_sent' | 'viewed' | 'selection_submitted' | 'in_editing' | 'delivered';
  videos?: { path: string; filename: string; originalName: string }[];
}

/** Minimal gallery shape used in admin list/card views */
export interface Gallery {
  _id: string;
  name: string;
  isDelivery: boolean;
  token?: string;
}

export interface GallerySubmission {
  _id: string;
  selectedImageIds: GalleryImage[];
  submittedAt: string;
  clientMessage?: string;
  heroImageId?: string;
  imageComments?: Record<string, string>;
}

/** Gallery shape returned by the showcase/listing endpoint */
export interface ShowcaseGallery {
  _id: string;
  name: string;
  clientName?: string;
  clientId?: { name: string; email: string };
}
