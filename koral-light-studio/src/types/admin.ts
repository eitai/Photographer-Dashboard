export interface AdminRecord {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'superadmin';
  username?: string | null;
  studioName?: string | null;
  createdAt: string;
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
