import api from '@/lib/api';
import type { Client } from '@/types/admin';

export const listClients = (): Promise<Client[]> => api.get('/clients').then((r) => r.data);

export const getClient = (id: string): Promise<Client> => api.get(`/clients/${id}`).then((r) => r.data);

export const updateClient = (id: string, data: Partial<Client>): Promise<Client> =>
  api.put(`/clients/${id}`, data).then((r) => r.data);

export const createClient = (data: Omit<Client, '_id' | 'createdAt'>): Promise<Client> =>
  api.post('/clients', data).then((r) => r.data);

export const deleteClient = (id: string) => api.delete(`/clients/${id}`);
