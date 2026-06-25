import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Loader2, Package, ImageOff } from 'lucide-react';
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

const TYPE_COLORS: Record<SupplierProduct['type'], { bg: string; text: string }> = {
  print:   { bg: '#f4f4f5', text: '#18181b' },
  canvas:  { bg: '#f4f4f5', text: '#18181b' },
  album:   { bg: '#f4f4f5', text: '#18181b' },
  digital: { bg: '#f4f4f5', text: '#18181b' },
  other:   { bg: '#f4f4f5', text: '#71717a' },
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
      print:   t('supplier.products.type_print'),
      canvas:  t('supplier.products.type_canvas'),
      album:   t('supplier.products.type_album'),
      digital: t('supplier.products.type_digital'),
      other:   t('supplier.products.type_other'),
    };
    return map[type];
  };

  const resolveImageUrl = (path: string): string =>
    path.startsWith('/') ? `${API_BASE}${path}` : path;

  return (
    <div className='p-6 md:p-8'>
      {/* Page header */}
      <div className='mb-8 flex justify-between items-start'>
        <div>
          <h1 className='text-2xl font-semibold text-zinc-900 tracking-tight'>
            {t('supplier.products.title')}
          </h1>
          {!isLoading && products && products.length > 0 && (
            <p className='text-sm text-zinc-500 mt-0.5'>
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </p>
          )}
        </div>
        <Button
          className='bg-foreground text-background hover:bg-foreground/90'
          onClick={() => { setEditingProduct(undefined); setModalOpen(true); }}
        >
          + {t('supplier.products.add')}
        </Button>
      </div>

      {/* Loading skeleton grid */}
      {isLoading && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
          {[...Array(8)].map((_, i) => (
            <div key={i} className='bg-white rounded-2xl border border-zinc-100 p-4 space-y-3'>
              <Skeleton className='aspect-square w-full rounded-xl' />
              <Skeleton className='h-4 w-3/4 rounded' />
              <Skeleton className='h-3 w-1/2 rounded' />
              <div className='flex justify-between items-center'>
                <Skeleton className='h-3 w-16 rounded' />
                <Skeleton className='h-5 w-9 rounded-full' />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!products || products.length === 0) && (
        <div className='flex flex-col items-center justify-center py-24 text-center'>
          <div className='w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4'>
            <Package size={28} className='text-zinc-400' />
          </div>
          <h3 className='text-base font-semibold text-zinc-700 mb-1'>
            {t('supplier.products.empty')}
          </h3>
          <p className='text-sm text-zinc-400 max-w-xs'>
            Products assigned to you will appear here.
          </p>
        </div>
      )}

      {/* Product grid */}
      {!isLoading && products && products.length > 0 && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
          {products.map((product) => {
            const typeStyle = TYPE_COLORS[product.type];
            return (
              <div
                key={product.id}
                className='group bg-white rounded-2xl border border-zinc-100 overflow-hidden transition-shadow duration-200 hover:shadow-md'
              >
                {/* Product image */}
                <div className='relative aspect-square bg-zinc-50 overflow-hidden'>
                  {product.imagePreviewPath ? (
                    <img
                      src={resolveImageUrl(product.imagePreviewPath)}
                      alt={product.name}
                      className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                    />
                  ) : (
                    <div className='h-full w-full flex flex-col items-center justify-center gap-2 text-zinc-300'>
                      <ImageOff size={32} />
                    </div>
                  )}

                  {/* Active badge overlay */}
                  <div className='absolute top-2.5 end-2.5'>
                    <span
                      className='inline-block w-2 h-2 rounded-full ring-2 ring-white'
                      style={{ backgroundColor: product.isActive ? '#18181b' : '#d4d4d8' }}
                    />
                  </div>
                </div>

                {/* Card body */}
                <div className='p-4'>
                  {/* Type badge */}
                  <span
                    className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mb-2'
                    style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                  >
                    {typeLabel(product.type)}
                  </span>

                  {/* Name */}
                  <h3 className='text-sm font-semibold text-zinc-900 truncate leading-snug mb-1'>
                    {product.name}
                  </h3>

                  {/* SKU */}
                  {product.sku && (
                    <p className='text-xs text-zinc-400 mb-2 font-mono'>
                      {product.sku}
                    </p>
                  )}

                  {/* Price row */}
                  <div className='flex items-baseline gap-2 mb-3'>
                    <span className='text-sm font-semibold text-zinc-900'>
                      ₪{product.costPrice.toFixed(2)}
                    </span>
                    {product.clientPrice !== null && (
                      <span className='text-xs text-zinc-400'>
                        / ₪{product.clientPrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Footer: active toggle + actions */}
                  <div className='flex items-center justify-between pt-3 border-t border-zinc-50'>
                    <Switch
                      checked={product.isActive}
                      onCheckedChange={() => handleToggleActive(product)}
                      disabled={togglingId === product.id}
                      aria-label={t('supplier.products.active')}
                    />
                    <div className='flex items-center gap-0.5'>
                      <button
                        onClick={() => handleOpenEdit(product)}
                        aria-label={t('supplier.products.edit')}
                        className='p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors duration-150 cursor-pointer'
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(product)}
                        aria-label={t('supplier.products.delete')}
                        className='p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 cursor-pointer'
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
