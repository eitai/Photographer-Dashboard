import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { InputField } from '@/components/admin/InputField';
import { AdminUserRow } from '@/components/admin/AdminUserRow';
import { AdminUserEditPanel } from '@/components/admin/AdminUserEditPanel';
import { CreateAdminForm } from '@/components/admin/CreateAdminForm';
import { ChangePlanModal } from '@/components/admin/ChangePlanModal';
import { useAdmins, useDeleteAdmin, useAdminPlans, useAdminSubscriptions } from '@/hooks/useQueries';
import type { AdminRecord } from '@/types/admin';

export const AdminUsers = () => {
  const { admin: me } = useAuth();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: admins = [], isError: adminsError } = useAdmins();
  const deleteAdminMutation = useDeleteAdmin();
  const { data: allPlans = [] } = useAdminPlans();
  const { data: subscriptions = [] } = useAdminSubscriptions();

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [planModalAdminId, setPlanModalAdminId] = useState<string | null>(null);

  useEffect(() => {
    if (adminsError) toast.error(t('admin.users.load_failed'));
  }, [adminsError, t]);

  useEffect(() => {
    const sso = searchParams.get('sso');
    if (!sso) return;
    if (sso === 'linked') toast.success(t('admin.settings.sso.linked_success'));
    else toast.error(t('admin.login.sso_error'));
    const next = new URLSearchParams(searchParams);
    next.delete('sso'); next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t]);

  const handleDelete = (id: string) => {
    setDeleteConfirmId(null);
    deleteAdminMutation.mutate(id, {
      onSuccess: () => { if (editingId === id) setEditingId(null); },
      onError: (err: unknown) => {
        const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
        toast.error(message || t('admin.users.delete_error'));
      },
    });
  };

  const currentSubFor = (adminId: string) => subscriptions.find((s) => s.adminId === adminId);
  const deletingId = deleteAdminMutation.isPending ? (deleteAdminMutation.variables ?? null) : null;

  const visibleAdmins = search.trim()
    ? admins.filter((a: AdminRecord) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
      )
    : admins;

  const planModalAdmin = (admins as AdminRecord[]).find((a) => a.id === planModalAdminId);

  const searchBar = (
    <div className='relative flex-1 max-w-xs'>
      <Search size={14} className='absolute top-1/2 -translate-y-1/2 start-3 text-warm-gray pointer-events-none' />
      <InputField
        type='text' value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={t('admin.users.search_placeholder')} className='ps-8'
      />
    </div>
  );

  return (
    <AdminLayout title={t('admin.users.title')} actions={searchBar}>
      <div className='max-w-3xl space-y-6'>
        {/* Admin list */}
        <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
          <h2 className='text-charcoal'>{t('admin.users.existing')}</h2>
          <div className='space-y-2'>
            {visibleAdmins.map((a: AdminRecord) => (
              <div key={a.id} className='space-y-0'>
                <AdminUserRow
                  admin={a}
                  currentUserId={me?.id}
                  isEditing={editingId === a.id}
                  deletingId={deletingId as string | null}
                  subscription={currentSubFor(a.id)}
                  onEdit={() => setEditingId(editingId === a.id ? null : a.id)}
                  onDelete={() => setDeleteConfirmId(a.id)}
                  onPlanModal={() => setPlanModalAdminId(a.id)}
                />
                {editingId === a.id && (
                  <AdminUserEditPanel admin={a} onClose={() => setEditingId(null)} />
                )}
              </div>
            ))}
            {visibleAdmins.length === 0 && (
              <p className='text-sm text-warm-gray text-center py-4'>{t('admin.users.no_users')}</p>
            )}
          </div>
        </div>

        <CreateAdminForm onCreated={() => {}} />
      </div>

      <ChangePlanModal
        admin={planModalAdmin}
        isOpen={!!planModalAdminId}
        onClose={() => setPlanModalAdminId(null)}
        allPlans={allPlans}
        currentSub={planModalAdmin ? currentSubFor(planModalAdmin.id) : undefined}
      />

      {deleteConfirmId && (
        <Modal isOpen onClose={() => setDeleteConfirmId(null)}>
          <h3 className='text-lg text-charcoal mb-2'>{t('admin.users.delete_confirm')}</h3>
          <p className='text-sm text-warm-gray mb-6'>{t('admin.common.action_irreversible')}</p>
          <div className='flex gap-3'>
            <button
              onClick={() => handleDelete(deleteConfirmId)}
              disabled={!!deletingId}
              className='flex-1 bg-rose-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
            >
              {deletingId ? t('admin.common.deleting') : t('admin.common.delete')}
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              disabled={!!deletingId}
              className='flex-1 py-3 rounded-xl text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
