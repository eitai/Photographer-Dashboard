import { create } from 'zustand';
import api from '@/lib/api';

interface GalleryState {
  galleries: any[];
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useGalleryStore = create<GalleryState>((set) => ({
  galleries: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/galleries');
      set({ galleries: res.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
