import { Shield, User, CreditCard, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { AdminRecord } from '@/types/admin';

interface Subscription {
  plan?: { name?: string; slug?: string } | null;
}

interface Props {
  admin: AdminRecord;
  currentUserId: string | undefined;
  isEditing: boolean;
  deletingId: string | null;
  subscription: Subscription | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onPlanModal: () => void;
}

export const AdminUserRow = ({
  admin, currentUserId, isEditing, deletingId, subscription,
  onEdit, onDelete, onPlanModal,
}: Props) => {
  const { t } = useI18n();
  const plan = subscription?.plan ?? null;
  const planName = plan?.name ?? 'Free';
  const isFree = !plan || plan.slug === 'free';

  return (
    <div className='flex items-center justify-between px-4 py-3 rounded-lg border border-beige bg-ivory'>
      <div className='flex items-center gap-3'>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          admin.role === 'superadmin' ? 'bg-amber-50 text-amber-700' : 'bg-blush/20 text-charcoal'
        }`}>
          {admin.role === 'superadmin' ? <Shield size={15} /> : <User size={15} />}
        </div>
        <div>
          <p className='text-sm font-medium text-charcoal flex items-center gap-2'>
            {admin.name}
            {admin.id === currentUserId && (
              <span className='text-[10px] bg-blush/20 text-charcoal px-1.5 py-0.5 rounded-full'>
                {t('admin.users.you')}
              </span>
            )}
          </p>
          <p className='text-xs text-warm-gray'>{admin.email}</p>
          {admin.username && <p className='text-xs text-warm-gray font-mono'>/{admin.username}</p>}
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          admin.role === 'superadmin' ? 'bg-amber-50 text-amber-700' : 'bg-beige text-warm-gray'
        }`}>
          {admin.role === 'superadmin' ? t('admin.users.superadmin_label') : t('admin.users.admin_label')}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isFree ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
        }`}>
          {planName}
        </span>
        <button
          onClick={onPlanModal}
          className='w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-blush hover:bg-blush/10 transition-colors'
          title='Change plan'
        >
          <CreditCard size={14} />
        </button>
        <a
          href={`/${admin.id}`}
          target='_blank'
          rel='noopener noreferrer'
          className='w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-blush hover:bg-blush/10 transition-colors'
          title={t('admin.users.view_landing')}
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={onEdit}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isEditing ? 'bg-charcoal text-white' : 'text-warm-gray hover:text-charcoal hover:bg-beige'
          }`}
          title={t('admin.users.edit')}
        >
          <Pencil size={14} />
        </button>
        {admin.id !== currentUserId && (
          <button
            onClick={onDelete}
            disabled={deletingId === admin.id}
            className='w-7 h-7 rounded-full flex items-center justify-center text-warm-gray hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40'
            title={t('admin.clients.delete_btn')}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
