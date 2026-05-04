import { useI18n } from '@/lib/i18n';

const STATUS_COLOR: Record<string, string> = {
  gallery_sent:        'bg-blue-100 text-blue-700',
  viewed:              'bg-yellow-100 text-yellow-700',
  selection_submitted: 'bg-blush/30 text-rose-700',
  in_editing:          'bg-purple-100 text-purple-700',
  delivered:           'bg-green-100 text-green-700',
};

export const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useI18n();
  const color = STATUS_COLOR[status] ?? 'bg-muted text-muted-foreground';
  const label = t(`admin.status.${status}`) !== `admin.status.${status}`
    ? t(`admin.status.${status}`)
    : status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
