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
  headerMessage: string;
  maxSelections: number;
  isDelivery: boolean;
  status: 'gallery_sent' | 'viewed' | 'selection_submitted' | 'in_editing' | 'delivered';
}

/** Minimal gallery shape used in admin list/card views */
export interface Gallery {
  _id: string;
  name: string;
  isDelivery: boolean;
  token?: string;
}

/** Gallery shape returned by the showcase/listing endpoint */
export interface ShowcaseGallery {
  _id: string;
  name: string;
  clientName?: string;
  clientId?: { name: string; email: string };
}
