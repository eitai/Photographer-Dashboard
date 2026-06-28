import { useI18n } from '@/lib/i18n';

const STATUS_COLOR: Record<string, string> = {
  gallery_sent:        'bg-[#D6EAF8] text-[#1A5276]',
  viewed:              'bg-[#FEF9E7] text-[#7D6608]',
  selection_submitted: 'bg-[#F7E4E3] text-[#8B3A38]',
  in_editing:          'bg-[#EEE0FF] text-[#5B2D8E]',
  delivered:           'bg-[#D5F5E3] text-[#1D6A39]',
  draft:               'bg-[#F2F3F4] text-[#626567]',
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
