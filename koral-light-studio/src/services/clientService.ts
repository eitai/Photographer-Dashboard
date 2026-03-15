import api from '@/lib/api';

export const listClients = () => api.get('/clients').then((r) => r.data);

export const getClient = (id: string) => api.get(`/clients/${id}`).then((r) => r.data);

export const updateClient = (id: string, data: any) => api.put(`/clients/${id}`, data).then((r) => r.data);

export const createClient = (data: any) => api.post('/clients', data).then((r) => r.data);

export const deleteClient = (id: string) => api.delete(`/clients/${id}`);
