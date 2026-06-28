import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/i18n';
import { API_BASE } from '@/lib/api';
import type { SupplierProduct } from '@/lib/api';
import {
  useCreateSupplierProduct,
  useUpdateSupplierProduct,
  useUploadSupplierProductImage,
} from '@/hooks/useQueries';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  product?: SupplierProduct;
}

type ProductType = SupplierProduct['type'];

interface VariationRow {
  name: string;
  optionsText: string;
}

interface FormState {
  name: string;
  type: ProductType | '';
  description: string;
  sku: string;
  costPrice: string;
  clientPrice: string;
  isActive: boolean;
  minPhotos: string;
  maxPhotos: string;
  productionDays: string;
  variations: VariationRow[];
}

const INITIAL_STATE: FormState = {
  name: '',
  type: '',
  description: '',
  sku: '',
  costPrice: '',
  clientPrice: '',
  isActive: true,
  minPhotos: '0',
  maxPhotos: '0',
  productionDays: '',
  variations: [],
};

export const ProductFormModal = ({ open, onClose, product }: ProductFormModalProps) => {
  const { t, dir } = useI18n();
  const isEditing = !!product;

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useCreateSupplierProduct();
  const updateMutation = useUpdateSupplierProduct();
  const uploadMutation = useUploadSupplierProductImage();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name,
          type: product.type,
          description: product.description ?? '',
          sku: product.sku ?? '',
          costPrice: String(product.costPrice),
          clientPrice: product.clientPrice !== null ? String(product.clientPrice) : '',
          isActive: product.isActive,
          minPhotos: String(product.minPhotos ?? 0),
          maxPhotos: String(product.maxPhotos ?? 0),
          productionDays: product.productionDays != null ? String(product.productionDays) : '',
          variations: (product.variations ?? []).map((v) => ({
            name: v.name,
            optionsText: v.options.join(', '),
          })),
        });
      } else {
        setForm(INITIAL_STATE);
      }
      setErrors({});
    }
  }, [open, product]);

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = t('admin.clients.name_required');
    if (!form.type) next.type = t('admin.common.error');
    const costNum = parseFloat(form.costPrice);
    if (!form.costPrice || isNaN(costNum) || costNum <= 0) next.costPrice = t('admin.common.error');
    const min = parseInt(form.minPhotos, 10) || 0;
    const max = parseInt(form.maxPhotos, 10) || 0;
    if (max > 0 && min > max) next.maxPhotos = t('supplier.products.minmax_error');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: Partial<SupplierProduct> = {
      name: form.name.trim(),
      type: form.type as ProductType,
      description: form.description.trim() || null,
      sku: form.sku.trim() || null,
      costPrice: parseFloat(form.costPrice),
      clientPrice: form.clientPrice ? parseFloat(form.clientPrice) : null,
      isActive: form.isActive,
      minPhotos: parseInt(form.minPhotos, 10) || 0,
      maxPhotos: parseInt(form.maxPhotos, 10) || 0,
      productionDays: form.productionDays ? parseInt(form.productionDays, 10) : null,
      variations: form.variations
        .map((v) => ({
          name: v.name.trim(),
          options: v.optionsText.split(',').map((s) => s.trim()).filter(Boolean),
        }))
        .filter((v) => v.name && v.options.length > 0),
    };

    try {
      if (isEditing && product) {
        await updateMutation.mutateAsync({ id: product.id, data: payload });
        toast.success(t('supplier.products.updated'));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t('supplier.products.created'));
      }
      onClose();
    } catch (err) {
      // Surface backend validation errors (422) instead of a generic toast.
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('admin.common.error');
      toast.error(message);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;
    try {
      await uploadMutation.mutateAsync({ id: product.id, file });
      toast.success(t('supplier.products.updated'));
    } catch {
      toast.error(t('admin.common.error'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const typeOptions: { value: ProductType; label: string }[] = [
    { value: 'print', label: t('supplier.products.type_print') },
    { value: 'canvas', label: t('supplier.products.type_canvas') },
    { value: 'album', label: t('supplier.products.type_album') },
    { value: 'digital', label: t('supplier.products.type_digital') },
    { value: 'other', label: t('supplier.products.type_other') },
  ];

  const imageUrl = product?.imagePreviewPath
    ? product.imagePreviewPath.startsWith('/')
      ? `${API_BASE}${product.imagePreviewPath}`
      : product.imagePreviewPath
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-theme="violet" dir={dir} className='max-w-md max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('supplier.products.edit') : t('supplier.products.add')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Name */}
          <div className='space-y-1.5'>
            <Label htmlFor='product-name'>{t('supplier.products.name')}</Label>
            <Input
              id='product-name'
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={isSubmitting}
            />
            {errors.name && <p className='text-red-500 text-xs'>{errors.name}</p>}
          </div>

          {/* Type */}
          <div className='space-y-1.5'>
            <Label>{t('supplier.products.type')}</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((p) => ({ ...p, type: v as ProductType }))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder='—' />
              </SelectTrigger>
              <SelectContent data-theme="violet" dir={dir}>
                {typeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className='text-red-500 text-xs'>{errors.type}</p>}
          </div>

          {/* Description */}
          <div className='space-y-1.5'>
            <Label htmlFor='product-desc'>{t('supplier.products.description')}</Label>
            <Textarea
              id='product-desc'
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('supplier.products.description_ph')}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* SKU */}
          <div className='space-y-1.5'>
            <Label htmlFor='product-sku'>{t('supplier.products.sku')}</Label>
            <Input
              id='product-sku'
              value={form.sku}
              onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
              disabled={isSubmitting}
            />
          </div>

          {/* Prices */}
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='product-cost'>{t('supplier.products.cost_price_label')}</Label>
              <Input
                id='product-cost'
                type='number'
                min='0.01'
                step='0.01'
                value={form.costPrice}
                onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))}
                disabled={isSubmitting}
              />
              {errors.costPrice && <p className='text-red-500 text-xs'>{errors.costPrice}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='product-client'>{t('supplier.products.client_price_label')}</Label>
              <Input
                id='product-client'
                type='number'
                min='0'
                step='0.01'
                value={form.clientPrice}
                onChange={(e) => setForm((p) => ({ ...p, clientPrice: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Photo requirements + production time */}
          <div className='grid grid-cols-3 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='product-min-photos'>{t('supplier.products.min_photos')}</Label>
              <Input
                id='product-min-photos'
                type='number'
                min='0'
                step='1'
                value={form.minPhotos}
                onChange={(e) => setForm((p) => ({ ...p, minPhotos: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='product-max-photos'>{t('supplier.products.max_photos')}</Label>
              <Input
                id='product-max-photos'
                type='number'
                min='0'
                step='1'
                value={form.maxPhotos}
                onChange={(e) => setForm((p) => ({ ...p, maxPhotos: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='product-production-days'>{t('supplier.products.production_days_label')}</Label>
              <Input
                id='product-production-days'
                type='number'
                min='1'
                step='1'
                value={form.productionDays}
                onChange={(e) => setForm((p) => ({ ...p, productionDays: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
          </div>
          {errors.maxPhotos && <p className='text-red-500 text-xs'>{errors.maxPhotos}</p>}

          {/* Variations editor */}
          <div className='space-y-2'>
            <Label>{t('supplier.products.variations')}</Label>
            {form.variations.map((row, idx) => (
              <div key={idx} className='flex items-start gap-2'>
                <Input
                  value={row.name}
                  placeholder={t('supplier.products.variation_name')}
                  className='w-32 shrink-0'
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      variations: p.variations.map((v, i) => (i === idx ? { ...v, name: e.target.value } : v)),
                    }))
                  }
                  disabled={isSubmitting}
                />
                <Input
                  value={row.optionsText}
                  placeholder={t('supplier.products.variation_options_ph')}
                  className='flex-1'
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      variations: p.variations.map((v, i) => (i === idx ? { ...v, optionsText: e.target.value } : v)),
                    }))
                  }
                  disabled={isSubmitting}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='shrink-0 text-red-500 hover:text-red-600'
                  onClick={() =>
                    setForm((p) => ({ ...p, variations: p.variations.filter((_, i) => i !== idx) }))
                  }
                  disabled={isSubmitting}
                  aria-label={t('supplier.products.delete')}
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>
            ))}
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                setForm((p) => ({ ...p, variations: [...p.variations, { name: '', optionsText: '' }] }))
              }
              disabled={isSubmitting}
            >
              + {t('supplier.products.add_variation')}
            </Button>
          </div>

          {/* Active toggle */}
          <div className='flex items-center gap-3'>
            <Switch
              id='product-active'
              checked={form.isActive}
              onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              disabled={isSubmitting}
            />
            <Label htmlFor='product-active'>{t('supplier.products.active')}</Label>
          </div>

          {/* Image section — only when editing */}
          {isEditing && product && (
            <div className='space-y-2 pt-2 border-t border-border'>
              <Label>{t('supplier.products.image')}</Label>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className='h-20 w-20 object-cover rounded-lg border border-border'
                />
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={handleImageChange}
                />
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={uploadMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin me-2' />
                  ) : (
                    <Upload className='h-4 w-4 me-2' />
                  )}
                  {t('supplier.products.upload_image')}
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={onClose} disabled={isSubmitting}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              type='submit'
              disabled={isSubmitting}
              className='bg-primary text-primary-foreground hover:bg-primary/90'
            >
              {isSubmitting ? (
                <Loader2 className='h-4 w-4 animate-spin me-2' />
              ) : null}
              {t('admin.common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
