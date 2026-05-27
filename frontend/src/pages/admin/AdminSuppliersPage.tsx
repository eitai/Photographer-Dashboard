import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Eye, EyeOff, Star, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import type { Supplier } from '@/lib/api';
import {
  useAdminSuppliers,
  useCreateAdminSupplier,
  useUpdateAdminSupplier,
  useDeleteAdminSupplier,
  useToggleSupplierActive,
  useSetSupplierExclusive,
} from '@/hooks/useQueries';

// ---------------------------------------------------------------------------
// Add Supplier Modal
// ---------------------------------------------------------------------------

interface AddSupplierModalProps {
  open: boolean;
  onClose: () => void;
}

const AddSupplierModal = ({ open, onClose }: AddSupplierModalProps) => {
  const { t } = useI18n();
  const createMutation = useCreateAdminSupplier();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    contactPerson: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
      });
      toast.success(t('admin.suppliers.created'));
      setForm({ name: '', email: '', password: '', phone: '', contactPerson: '' });
      onClose();
    } catch {
      toast.error(t('admin.common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='font-serif'>{t('admin.suppliers.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.name')}</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={createMutation.isPending}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.email')}</Label>
            <Input
              type='email'
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              disabled={createMutation.isPending}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.password')}</Label>
            <Input
              type='password'
              required
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              disabled={createMutation.isPending}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.phone')}</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              disabled={createMutation.isPending}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.contact_person')}</Label>
            <Input
              value={form.contactPerson}
              onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
              disabled={createMutation.isPending}
            />
          </div>
          <DialogFooter className='gap-2'>
            <Button type='button' variant='outline' onClick={onClose} disabled={createMutation.isPending}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              type='submit'
              disabled={createMutation.isPending}
              className='bg-blush text-white hover:bg-blush/90'
            >
              {createMutation.isPending && <Loader2 className='h-4 w-4 animate-spin me-2' />}
              {t('admin.common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Edit Supplier Modal
// ---------------------------------------------------------------------------

interface EditSupplierModalProps {
  open: boolean;
  onClose: () => void;
  supplier: Supplier;
}

const EditSupplierModal = ({ open, onClose, supplier }: EditSupplierModalProps) => {
  const { t } = useI18n();
  const updateMutation = useUpdateAdminSupplier();

  const [form, setForm] = useState({
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone ?? '',
    contactPerson: supplier.contactPerson ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        id: supplier.id,
        data: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          contactPerson: form.contactPerson.trim() || null,
        },
      });
      toast.success(t('admin.suppliers.updated'));
      onClose();
    } catch {
      toast.error(t('admin.common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='font-serif'>{t('admin.users.edit')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.name')}</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={updateMutation.isPending}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.email')}</Label>
            <Input
              type='email'
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              disabled={updateMutation.isPending}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.phone')}</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              disabled={updateMutation.isPending}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>{t('admin.suppliers.contact_person')}</Label>
            <Input
              value={form.contactPerson}
              onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
              disabled={updateMutation.isPending}
            />
          </div>
          <DialogFooter className='gap-2'>
            <Button type='button' variant='outline' onClick={onClose} disabled={updateMutation.isPending}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              type='submit'
              disabled={updateMutation.isPending}
              className='bg-blush text-white hover:bg-blush/90'
            >
              {updateMutation.isPending && <Loader2 className='h-4 w-4 animate-spin me-2' />}
              {t('admin.common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const AdminSuppliersPage = () => {
  const { t } = useI18n();
  const { data: suppliers, isLoading } = useAdminSuppliers();
  const deleteMutation = useDeleteAdminSupplier();
  const toggleActiveMutation = useToggleSupplierActive();
  const setExclusiveMutation = useSetSupplierExclusive();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      await toggleActiveMutation.mutateAsync(supplier.id);
      toast.success(t('admin.suppliers.toggle_active'));
    } catch {
      toast.error(t('admin.common.error'));
    }
  };

  const handleSetExclusive = async (supplier: Supplier) => {
    try {
      await setExclusiveMutation.mutateAsync(supplier.id);
      toast.success(t('admin.suppliers.updated'));
    } catch {
      toast.error(t('admin.common.error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(t('admin.suppliers.deleted'));
      setDeleteTarget(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error(t('admin.suppliers.delete_blocked'));
      } else {
        toast.error(t('admin.common.error'));
      }
      setDeleteTarget(null);
    }
  };

  return (
    <AdminLayout>
      <div className='p-6'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <h1 className='font-serif text-2xl text-charcoal'>
            {t('admin.suppliers.title')}
          </h1>
          <Button
            onClick={() => setAddOpen(true)}
            className='bg-blush text-white hover:bg-blush/90 gap-2'
          >
            <Plus size={16} />
            {t('admin.suppliers.add')}
          </Button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className='space-y-3'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-12 w-full rounded-lg' />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!suppliers || suppliers.length === 0) && (
          <div className='text-center py-16 text-zinc-400'>
            <p>{t('admin.suppliers.empty')}</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && suppliers && suppliers.length > 0 && (
          <div className='bg-white rounded-xl border border-zinc-200 overflow-hidden'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.suppliers.name')}</TableHead>
                  <TableHead>{t('admin.suppliers.email')}</TableHead>
                  <TableHead>{t('admin.suppliers.phone')}</TableHead>
                  <TableHead>{t('admin.suppliers.contact')}</TableHead>
                  <TableHead>{t('admin.suppliers.exclusive')}</TableHead>
                  <TableHead>{t('admin.common.status')}</TableHead>
                  <TableHead>{t('admin.suppliers.orders_count')}</TableHead>
                  <TableHead className='w-40'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className='font-medium text-charcoal'>
                      {supplier.name}
                    </TableCell>
                    <TableCell className='text-sm text-zinc-600'>
                      {supplier.email}
                    </TableCell>
                    <TableCell className='text-sm text-zinc-500'>
                      {supplier.phone ?? '—'}
                    </TableCell>
                    <TableCell className='text-sm text-zinc-500'>
                      {supplier.contactPerson ?? '—'}
                    </TableCell>

                    {/* Exclusive badge */}
                    <TableCell>
                      {supplier.isExclusive ? (
                        <span className='inline-flex items-center gap-1 text-amber-600 text-sm font-medium'>
                          <Star size={14} className='fill-amber-400 text-amber-400' />
                          {t('admin.suppliers.exclusive')}
                        </span>
                      ) : (
                        <span className='text-zinc-400 text-sm'>—</span>
                      )}
                    </TableCell>

                    {/* Active badge */}
                    <TableCell>
                      <Badge
                        variant={supplier.isActive ? 'default' : 'secondary'}
                        className={supplier.isActive ? 'bg-green-100 text-green-700' : ''}
                      >
                        {supplier.isActive
                          ? t('admin.billing.status_active')
                          : t('admin.billing.status_inactive')}
                      </Badge>
                    </TableCell>

                    {/* Order count */}
                    <TableCell className='text-sm text-zinc-600'>
                      {supplier.orderCount ?? 0}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className='flex items-center gap-1'>
                        {/* Edit */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => setEditTarget(supplier)}
                              aria-label={t('admin.users.edit')}
                            >
                              <Pencil size={15} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('admin.users.edit')}</TooltipContent>
                        </Tooltip>

                        {/* Toggle active */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => handleToggleActive(supplier)}
                              disabled={toggleActiveMutation.isPending}
                              aria-label={t('admin.suppliers.toggle_active')}
                            >
                              {supplier.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('admin.suppliers.toggle_active')}</TooltipContent>
                        </Tooltip>

                        {/* Set exclusive — only when not exclusive */}
                        {!supplier.isExclusive && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                onClick={() => handleSetExclusive(supplier)}
                                disabled={setExclusiveMutation.isPending}
                                aria-label={t('admin.suppliers.set_exclusive')}
                              >
                                <Star size={15} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('admin.suppliers.set_exclusive')}</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Delete — disabled when has orders */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='text-red-500 hover:text-red-600 hover:bg-red-50 disabled:pointer-events-none'
                                onClick={() => setDeleteTarget(supplier)}
                                disabled={(supplier.orderCount ?? 0) > 0}
                                aria-label={t('admin.common.delete')}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {(supplier.orderCount ?? 0) > 0 && (
                            <TooltipContent>{t('admin.suppliers.delete_blocked')}</TooltipContent>
                          )}
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add supplier modal */}
        <AddSupplierModal open={addOpen} onClose={() => setAddOpen(false)} />

        {/* Edit supplier modal */}
        {editTarget && (
          <EditSupplierModal
            open={!!editTarget}
            onClose={() => setEditTarget(null)}
            supplier={editTarget}
          />
        )}

        {/* Delete confirm dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <DialogContent className='max-w-sm'>
            <DialogHeader>
              <DialogTitle>{t('admin.common.delete')}</DialogTitle>
              <DialogDescription>{t('admin.common.action_irreversible')}</DialogDescription>
            </DialogHeader>
            <DialogFooter className='gap-2'>
              <Button variant='outline' onClick={() => setDeleteTarget(null)}>
                {t('admin.common.cancel')}
              </Button>
              <Button
                variant='destructive'
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className='h-4 w-4 animate-spin me-2' />
                )}
                {t('admin.common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};
