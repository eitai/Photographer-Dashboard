import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { API_BASE } from '@/lib/api';
import type { SupplierProduct } from '@/lib/api';
import {
  useSupplierProducts,
  useUpdateSupplierProduct,
  useDeleteSupplierProduct,
} from '@/hooks/useQueries';
import { ProductFormModal } from '@/components/supplier/ProductFormModal';

const TYPE_COLORS: Record<SupplierProduct['type'], string> = {
  print: 'bg-blue-100 text-blue-700',
  canvas: 'bg-purple-100 text-purple-700',
  album: 'bg-pink-100 text-pink-700',
  digital: 'bg-green-100 text-green-700',
  other: 'bg-zinc-100 text-zinc-600',
};

export const SupplierProducts = () => {
  const { t } = useI18n();
  const { data: products, isLoading } = useSupplierProducts();
  const updateMutation = useUpdateSupplierProduct();
  const deleteMutation = useDeleteSupplierProduct();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<SupplierProduct | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingProduct(undefined);
    setModalOpen(true);
  };

  const handleOpenEdit = (product: SupplierProduct) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleToggleActive = async (product: SupplierProduct) => {
    setTogglingId(product.id);
    try {
      await updateMutation.mutateAsync({ id: product.id, data: { isActive: !product.isActive } });
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(t('supplier.products.deleted'));
      setDeleteTarget(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error(t('supplier.products.delete_blocked'));
      } else {
        toast.error(t('admin.common.error'));
      }
      setDeleteTarget(null);
    }
  };

  const typeLabel = (type: SupplierProduct['type']): string => {
    const map: Record<SupplierProduct['type'], string> = {
      print: t('supplier.products.type_print'),
      canvas: t('supplier.products.type_canvas'),
      album: t('supplier.products.type_album'),
      digital: t('supplier.products.type_digital'),
      other: t('supplier.products.type_other'),
    };
    return map[type];
  };

  const resolveImageUrl = (path: string): string =>
    path.startsWith('/') ? `${API_BASE}${path}` : path;

  return (
    <div className='p-6'>
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <h1 className='font-serif text-2xl text-charcoal'>
          {t('supplier.products.title')}
        </h1>
        <Button
          onClick={handleOpenAdd}
          className='bg-blush text-white hover:bg-blush/90 gap-2'
        >
          <Plus size={16} />
          {t('supplier.products.add')}
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
      {!isLoading && (!products || products.length === 0) && (
        <div className='text-center py-16 text-zinc-400'>
          <p>{t('supplier.products.empty')}</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && products && products.length > 0 && (
        <div className='bg-white rounded-xl border border-zinc-200 overflow-hidden'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-12'>{t('supplier.products.image')}</TableHead>
                <TableHead>{t('supplier.products.name')}</TableHead>
                <TableHead>{t('supplier.products.type')}</TableHead>
                <TableHead>{t('supplier.products.sku')}</TableHead>
                <TableHead>{t('supplier.products.cost_price')}</TableHead>
                <TableHead>{t('supplier.products.client_price')}</TableHead>
                <TableHead>{t('supplier.products.active')}</TableHead>
                <TableHead className='w-20'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  {/* Thumbnail */}
                  <TableCell>
                    {product.imagePreviewPath ? (
                      <img
                        src={resolveImageUrl(product.imagePreviewPath)}
                        alt={product.name}
                        className='h-10 w-10 rounded object-cover'
                      />
                    ) : (
                      <div className='h-10 w-10 rounded bg-zinc-100 flex items-center justify-center text-zinc-300'>
                        <Plus size={14} />
                      </div>
                    )}
                  </TableCell>

                  {/* Name */}
                  <TableCell className='font-medium text-charcoal'>{product.name}</TableCell>

                  {/* Type badge */}
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[product.type]}`}
                    >
                      {typeLabel(product.type)}
                    </span>
                  </TableCell>

                  {/* SKU */}
                  <TableCell className='text-zinc-500 text-sm'>
                    {product.sku ?? '—'}
                  </TableCell>

                  {/* Cost price */}
                  <TableCell className='text-sm'>
                    ₪{product.costPrice.toFixed(2)}
                  </TableCell>

                  {/* Client price */}
                  <TableCell className='text-sm'>
                    {product.clientPrice !== null ? `₪${product.clientPrice.toFixed(2)}` : '—'}
                  </TableCell>

                  {/* Active toggle */}
                  <TableCell>
                    <Switch
                      checked={product.isActive}
                      onCheckedChange={() => handleToggleActive(product)}
                      disabled={togglingId === product.id}
                      aria-label={t('supplier.products.active')}
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className='flex items-center gap-1'>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => handleOpenEdit(product)}
                        aria-label={t('supplier.products.edit')}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='text-red-500 hover:text-red-600 hover:bg-red-50'
                        onClick={() => setDeleteTarget(product)}
                        aria-label={t('supplier.products.delete')}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Product form modal */}
      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={editingProduct}
      />

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle>{t('supplier.products.delete')}</DialogTitle>
            <DialogDescription>{t('supplier.products.delete_confirm')}</DialogDescription>
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
              {deleteMutation.isPending ? (
                <Loader2 className='h-4 w-4 animate-spin me-2' />
              ) : null}
              {t('supplier.products.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
