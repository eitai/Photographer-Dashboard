import { create } from 'zustand';
import api from '@/lib/api';

interface ClientState {
  clients: any[];
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useClientStore = create<ClientState>((set) => ({
  clients: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/clients');
      set({ clients: res.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
