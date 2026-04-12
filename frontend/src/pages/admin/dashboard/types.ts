import type { Client } from '@/types/admin';
import type { GalleryData } from '@/types/gallery';

export type FilterChip = 'all' | 'active' | 'pending' | 'delivered';

export type GalleryStatus = GalleryData['status'];

export interface RichGallery extends GalleryData {
  clientName: string;
  clientId: string | { id: string; name: string; email: string };
}

export const ACTIVE_STATUSES: GalleryStatus[] = ['viewed', 'selection_submitted', 'in_editing'];

export function resolveClientId(clientId: RichGallery['clientId']): string | undefined {
  if (!clientId) return undefined;
  if (typeof clientId === 'object') return clientId.id;
  return clientId;
}

export function matchesClient(g: RichGallery, client: Client): boolean {
  const id = resolveClientId(g.clientId);
  if (!id) return false;
  return id === client._id;
}

export function getClientFilter(client: Client, galleries: RichGallery[]): FilterChip {
  const clientGalleries = galleries.filter((g) => matchesClient(g, client));
  if (clientGalleries.length === 0) return 'pending';
  const hasActive = clientGalleries.some((g) => ACTIVE_STATUSES.includes(g.status as GalleryStatus));
  if (hasActive) return 'active';
  const allDelivered = clientGalleries.every((g) => g.status === 'delivered');
  if (allDelivered) return 'delivered';
  return 'pending';
}

export function formatRelativeTime(dateStr: string | undefined, t: (k: string) => string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return t('admin.dashboard.time_just_now');
  if (mins < 60) return t('admin.dashboard.time_minutes_ago').replace('{n}', String(mins));
  if (hours < 24) return t('admin.dashboard.time_hours_ago').replace('{n}', String(hours));
  return t('admin.dashboard.time_days_ago').replace('{n}', String(days));
}
