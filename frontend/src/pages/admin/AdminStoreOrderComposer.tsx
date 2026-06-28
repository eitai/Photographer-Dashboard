import { useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useAdminSupplierProducts, useClients, useGalleries, useCreateDirectOrder } from '@/hooks/useQueries';
import {
  getImageUrl,
  getGalleryImages,
  uploadDirectOrderImages,
  type AdminSupplierProduct,
  type AdminGalleryImage,
} from '@/lib/api';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Upload, Loader2, Check, Clock } from 'lucide-react';

type PhotoSource = 'upload' | 'gallery';
type ShipMode = 'mine' | 'client' | 'custom';

interface SelectedImage {
  id: string;
  thumbnailPath: string | null;
  path: string;
}

const imgId = (img: AdminGalleryImage) => img.id || img._id || '';

export const AdminStoreOrderComposer = () => {
  const { productId } = useParams<{ productId: string }>();
  const { t, dir } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const admin = useAuthStore((s) => s.admin);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const { data: products = [], isLoading: productsLoading } = useAdminSupplierProducts();
  const product = useMemo<AdminSupplierProduct | undefined>(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );

  const { data: clients = [] } = useClients();
  const { data: galleries = [] } = useGalleries();
  const createOrder = useCreateDirectOrder();

  const [quantity, setQuantity] = useState(1);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [photoSource, setPhotoSource] = useState<PhotoSource>('upload');
  const [selected, setSelected] = useState<Record<string, SelectedImage>>({});
  const [activeGalleryId, setActiveGalleryId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [shipMode, setShipMode] = useState<ShipMode>('mine');
  const [clientId, setClientId] = useState('');
  const [custom, setCustom] = useState({ name: '', street: '', apartment: '', city: '', zip: '', country: 'ישראל', phone: '' });
  const [note, setNote] = useState('');

  const { data: galleryImages = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['admin-gallery-images', activeGalleryId],
    queryFn: () => getGalleryImages(activeGalleryId),
    enabled: photoSource === 'gallery' && !!activeGalleryId,
  });

  const minPhotos = product?.minPhotos ?? 0;
  const maxPhotos = product?.maxPhotos ?? 0;
  const variations = product?.variations ?? [];
  const selectedCount = Object.keys(selected).length;
  const atMax = maxPhotos > 0 && selectedCount >= maxPhotos;
  const countOk = selectedCount >= minPhotos && (maxPhotos === 0 || selectedCount <= maxPhotos);
  const optionsOk = variations.every((v) => !!options[v.name]);

  const requirementText =
    minPhotos > 0 && maxPhotos > 0
      ? t('store.photos_requirement').replace('{min}', String(minPhotos)).replace('{max}', String(maxPhotos))
      : minPhotos > 0
      ? t('store.photos_min_only').replace('{min}', String(minPhotos))
      : maxPhotos > 0
      ? t('store.photos_max_only').replace('{max}', String(maxPhotos))
      : null;

  const toggleImage = (img: AdminGalleryImage) => {
    const id = imgId(img);
    setSelected((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (maxPhotos > 0 && Object.keys(prev).length >= maxPhotos) return prev;
      return { ...prev, [id]: { id, thumbnailPath: img.thumbnailPath, path: img.path } };
    });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const res = await uploadDirectOrderImages(Array.from(files));
      setSelected((prev) => {
        const next = { ...prev };
        for (const img of res.images) {
          if (maxPhotos > 0 && Object.keys(next).length >= maxPhotos) break;
          next[img.id] = { id: img.id, thumbnailPath: img.thumbnailPath, path: img.path };
        }
        return next;
      });
    } catch {
      toast({ title: t('admin.common.error'), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resolveShipping = () => {
    if (shipMode === 'mine') {
      if (!admin?.addressStreet || !admin?.addressCity) return null;
      return {
        name: admin.studioName || admin.name || '',
        street: admin.addressStreet,
        apartment: admin.addressApartment || undefined,
        city: admin.addressCity,
        zip: admin.addressZip || undefined,
        country: admin.addressCountry || 'ישראל',
      };
    }
    if (shipMode === 'client') {
      const c = clients.find((cl) => (cl._id || cl.id) === clientId);
      if (!c || !c.addressStreet || !c.addressCity) return null;
      return {
        name: c.name,
        street: c.addressStreet,
        apartment: c.addressApartment || undefined,
        city: c.addressCity,
        zip: c.addressZip || undefined,
        country: c.addressCountry || 'ישראל',
        phone: c.phone || undefined,
      };
    }
    if (!custom.name.trim() || !custom.street.trim() || !custom.city.trim()) return null;
    return {
      name: custom.name.trim(),
      street: custom.street.trim(),
      apartment: custom.apartment.trim() || undefined,
      city: custom.city.trim(),
      zip: custom.zip.trim() || undefined,
      country: custom.country.trim() || 'ישראל',
      phone: custom.phone.trim() || undefined,
    };
  };

  const handleSubmit = () => {
    if (!product) return;
    const shippingAddress = resolveShipping();
    if (!shippingAddress) {
      toast({ title: t('store.direct.no_address'), variant: 'destructive' });
      return;
    }
    createOrder.mutate(
      {
        items: [{
          productId: product.id,
          quantity,
          selectedImageIds: Object.keys(selected),
          productOptions: Object.keys(options).length ? options : undefined,
        }],
        shippingAddress,
        photographerNote: note.trim() || undefined,
      },
      {
        onSuccess: (order) => navigate(`/admin/orders/${order.id}`),
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast({ title: msg || t('admin.common.error'), variant: 'destructive' });
        },
      },
    );
  };

  if (productsLoading) {
    return (
      <AdminLayout>
        <div className='p-6 space-y-4'><Skeleton className='h-8 w-48' /><Skeleton className='h-64' /></div>
      </AdminLayout>
    );
  }

  if (!product) {
    return (
      <AdminLayout>
        <div className='p-6 text-center text-warm-gray'>{t('admin.common.error')}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className='p-6 space-y-6 max-w-3xl' dir={dir}>
        <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <Button variant='ghost' size='sm' onClick={() => navigate('/admin/store')} className='gap-1'>
            <BackIcon size={16} />
            {t('store.direct.back_to_store')}
          </Button>
          <h1 className='font-serif text-xl text-charcoal'>{product.name}</h1>
        </div>

        {/* Product + options */}
        <section className='bg-card rounded-xl border border-beige p-5 space-y-4'>
          <div className={`flex items-center justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <span className='text-sm text-warm-gray'>{t('store.quantity')}</span>
            <div className='flex items-center gap-3'>
              <button type='button' onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}
                className='w-8 h-8 rounded-full border border-beige flex items-center justify-center hover:bg-ivory disabled:opacity-40'>−</button>
              <span className='w-8 text-center font-semibold text-charcoal'>{quantity}</span>
              <button type='button' onClick={() => setQuantity((q) => q + 1)}
                className='w-8 h-8 rounded-full border border-beige flex items-center justify-center hover:bg-ivory'>+</button>
            </div>
          </div>

          {product.productionDays != null && (
            <p className='text-xs text-warm-gray flex items-center gap-1.5'>
              <Clock size={12} />
              {t('store.production_days').replace('{n}', String(product.productionDays))}
            </p>
          )}

          {variations.map((variation) => (
            <div key={variation.name}>
              <Label className='text-xs text-warm-gray'>{variation.name}</Label>
              <Select value={options[variation.name] ?? ''} onValueChange={(v) => setOptions((p) => ({ ...p, [variation.name]: v }))}>
                <SelectTrigger className='mt-1'><SelectValue placeholder='—' /></SelectTrigger>
                <SelectContent>
                  {variation.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </section>

        {/* Photos */}
        <section className='bg-card rounded-xl border border-beige p-5 space-y-4'>
          <div className={`flex items-center justify-between ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <h2 className='font-medium text-charcoal'>{t('store.direct.selected_photos')}</h2>
            <span className={`text-sm ${requirementText && !countOk ? 'text-flag-ink font-medium' : 'text-warm-gray'}`}>
              {selectedCount}{requirementText ? ` · ${requirementText}` : ''}
            </span>
          </div>

          <div className='flex gap-2 border-b border-beige'>
            {(['upload', 'gallery'] as PhotoSource[]).map((src) => (
              <button key={src} type='button' onClick={() => setPhotoSource(src)}
                className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                  photoSource === src ? 'border-primary text-primary' : 'border-transparent text-warm-gray hover:text-charcoal'
                }`}>
                {src === 'upload' ? t('store.direct.upload_tab') : t('store.direct.galleries_tab')}
              </button>
            ))}
          </div>

          {photoSource === 'upload' ? (
            <div>
              <input ref={fileRef} type='file' accept='image/*' multiple className='hidden' onChange={(e) => handleUpload(e.target.files)} />
              <button type='button' onClick={() => fileRef.current?.click()} disabled={uploading || atMax}
                className='w-full border-2 border-dashed border-beige rounded-xl py-8 flex flex-col items-center gap-2 text-warm-gray hover:border-charcoal/40 transition-colors disabled:opacity-50'>
                {uploading ? <Loader2 size={22} className='animate-spin' /> : <Upload size={22} />}
                <span className='text-sm'>{uploading ? t('store.direct.uploading') : t('store.direct.drop_hint')}</span>
              </button>
            </div>
          ) : (
            <div className='space-y-3'>
              <Select value={activeGalleryId} onValueChange={setActiveGalleryId}>
                <SelectTrigger><SelectValue placeholder={t('store.direct.pick_gallery')} /></SelectTrigger>
                <SelectContent>
                  {galleries.map((g) => <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {imagesLoading ? (
                <div className='grid grid-cols-4 sm:grid-cols-6 gap-2'>
                  {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className='aspect-square rounded-lg' />)}
                </div>
              ) : galleryImages.length > 0 ? (
                <div className='grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-80 overflow-y-auto'>
                  {galleryImages.map((img) => {
                    const id = imgId(img);
                    const isSel = !!selected[id];
                    return (
                      <button key={id} type='button' onClick={() => toggleImage(img)} disabled={!isSel && atMax}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          isSel ? 'border-primary' : 'border-transparent'
                        } ${!isSel && atMax ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <img src={getImageUrl(img.thumbnailPath || img.path)} alt={img.filename} loading='lazy' className='w-full h-full object-cover' />
                        {isSel && (
                          <div className='absolute inset-0 bg-charcoal/20 flex items-center justify-center'>
                            <span className='w-5 h-5 rounded-full bg-primary flex items-center justify-center'><Check size={12} className='text-white' /></span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : activeGalleryId ? (
                <p className='text-sm text-warm-gray text-center py-6'>{t('gallery.no_images')}</p>
              ) : null}
            </div>
          )}

          {/* Selected previews from uploads */}
          {selectedCount > 0 && (
            <div className='grid grid-cols-6 sm:grid-cols-8 gap-2 pt-2 border-t border-beige'>
              {Object.values(selected).map((img) => (
                <div key={img.id} className='relative aspect-square rounded overflow-hidden ring-1 ring-beige'>
                  <img src={getImageUrl(img.thumbnailPath || img.path)} alt='' className='w-full h-full object-cover' />
                  <button type='button' onClick={() => setSelected((p) => { const n = { ...p }; delete n[img.id]; return n; })}
                    className='absolute top-0.5 end-0.5 w-4 h-4 rounded-full bg-charcoal/70 text-white flex items-center justify-center text-[10px]'>×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Shipping */}
        <section className='bg-card rounded-xl border border-beige p-5 space-y-4'>
          <h2 className='font-medium text-charcoal'>{t('store.direct.shipping_title')}</h2>
          <div className='flex flex-wrap gap-2'>
            {(['mine', 'client', 'custom'] as ShipMode[]).map((mode) => (
              <button key={mode} type='button' onClick={() => setShipMode(mode)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  shipMode === mode ? 'border-primary bg-primary text-white' : 'border-beige text-charcoal hover:border-charcoal'
                }`}>
                {mode === 'mine' ? t('store.direct.shipping_mine') : mode === 'client' ? t('store.direct.shipping_client') : t('store.direct.shipping_custom')}
              </button>
            ))}
          </div>

          {shipMode === 'mine' && (
            !admin?.addressStreet ? (
              <p className='text-sm text-warm-gray'>
                {t('store.direct.no_address')} · <Link to='/admin/settings' className='underline'>{t('admin.nav.settings')}</Link>
              </p>
            ) : (
              <p className='text-sm text-charcoal'>{admin.addressStreet}{admin.addressApartment ? `, ${admin.addressApartment}` : ''}, {admin.addressCity} {admin.addressZip ?? ''}</p>
            )
          )}

          {shipMode === 'client' && (
            <div className='space-y-2'>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder={t('store.direct.pick_client')} /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c._id || c.id} value={c._id || c.id || ''}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {clientId && (() => {
                const c = clients.find((cl) => (cl._id || cl.id) === clientId);
                return c?.addressStreet
                  ? <p className='text-sm text-charcoal'>{c.addressStreet}{c.addressApartment ? `, ${c.addressApartment}` : ''}, {c.addressCity} {c.addressZip ?? ''}</p>
                  : <p className='text-sm text-warm-gray'>{t('store.direct.no_client_address')}</p>;
              })()}
            </div>
          )}

          {shipMode === 'custom' && (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='sm:col-span-2'>
                <Label className='text-xs text-warm-gray'>{t('selection.shipping.name')} *</Label>
                <Input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
              </div>
              <div>
                <Label className='text-xs text-warm-gray'>{t('admin.client.address_street')} *</Label>
                <Input value={custom.street} onChange={(e) => setCustom({ ...custom, street: e.target.value })} />
              </div>
              <div>
                <Label className='text-xs text-warm-gray'>{t('admin.client.address_apartment')}</Label>
                <Input value={custom.apartment} onChange={(e) => setCustom({ ...custom, apartment: e.target.value })} />
              </div>
              <div>
                <Label className='text-xs text-warm-gray'>{t('admin.client.address_city')} *</Label>
                <Input value={custom.city} onChange={(e) => setCustom({ ...custom, city: e.target.value })} />
              </div>
              <div>
                <Label className='text-xs text-warm-gray'>{t('admin.client.address_zip')}</Label>
                <Input value={custom.zip} onChange={(e) => setCustom({ ...custom, zip: e.target.value })} />
              </div>
              <div>
                <Label className='text-xs text-warm-gray'>{t('selection.shipping.phone')}</Label>
                <Input value={custom.phone} onChange={(e) => setCustom({ ...custom, phone: e.target.value })} type='tel' />
              </div>
            </div>
          )}
        </section>

        {/* Note + submit */}
        <section className='space-y-3'>
          <div>
            <Label className='text-xs text-warm-gray'>{t('orders.note.photographer')}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className='mt-1' />
          </div>
          <Button onClick={handleSubmit} disabled={!countOk || !optionsOk || createOrder.isPending}
            className='w-full bg-primary hover:bg-primary/90 text-white gap-2'>
            {createOrder.isPending ? <Loader2 size={16} className='animate-spin' /> : null}
            {createOrder.isPending ? t('store.direct.submitting') : t('store.direct.submit')}
          </Button>
        </section>
      </div>
    </AdminLayout>
  );
};
