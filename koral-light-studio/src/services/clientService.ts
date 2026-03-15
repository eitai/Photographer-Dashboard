import api from '@/lib/api';

export const getClient = (id: string) => api.get(`/clients/${id}`).then((r) => r.data);

export const updateClient = (id: string, data: any) => api.put(`/clients/${id}`, data).then((r) => r.data);
