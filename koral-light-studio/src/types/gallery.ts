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
}
