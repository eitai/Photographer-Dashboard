import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useI18n } from '@/lib/i18n';
import { useSupplierOrder, useUpdateSupplierOrderStatus } from '@/hooks/useQueries';
import { getSupplierOrderDownloadUrls } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Download } from 'lucide-react';
import type { StoreOrder } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  pending_selection: 'bg-yellow-100 text-yellow-700',
  selection_submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  sent_to_supplier: 'bg-purple-100 text-purple-700',
  in_production: 'bg-orange-100 text-orange-700',
  shipped: 'bg-sky-100 text-sky-700',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-600',
};

type SupplierStatus = 'in_production' | 'shipped' | 'delivered';

const NEXT_STATUSES: Record<string, SupplierStatus[]> = {
  sent_to_supplier: ['in_production'],
  in_production: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
};

export const SupplierOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, dir } = useI18n();
  const { toast } = useToast();

  const { data: order, isLoading } = useSupplierOrder(id ?? '');
  const updateStatus = useUpdateSupplierOrderStatus();

  const [newStatus, setNewStatus] = useState<SupplierStatus | ''>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [supplierNote, setSupplierNote] = useState('');
  const [downloadingImages, setDownloadingImages] = useState(false);

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const availableStatuses: SupplierStatus[] = order
    ? (NEXT_STATUSES[order.status] ?? [])
    : [];

  const handleUpdateStatus = () => {
    if (!id || !newStatus) return;
    updateStatus.mutate(
      {
        id,
        data: {
          status: newStatus,
          trackingNumber: trackingNumber.trim() || undefined,
          trackingCarrier: trackingCarrier.trim() || undefined,
          supplierNote: supplierNote.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t('supplier.orders.update_status') });
          setNewStatus('');
          setTrackingNumber('');
          setTrackingCarrier('');
          setSupplierNote('');
        },
        onError: () => toast({ title: t('admin.common.error'), variant: 'destructive' }),
      },
    );
  };

  const handleDownloadImages = async () => {
    if (!id) return;
    setDownloadingImages(true);
    try {
      const { urls } = await getSupplierOrderDownloadUrls(id);
      if (urls.length === 0) {
        toast({ title: dir === 'rtl' ? 'אין תמונות להורדה' : 'No images to download' });
        return;
      }
      const zip = new JSZip();
      const folder = zip.folder('images') ?? zip;
      const CONCURRENCY = 5;
      for (let i = 0; i < urls.length; i += CONCURRENCY) {
        await Promise.all(
          urls.slice(i, i + CONCURRENCY).map(async (url, batchIdx) => {
            const globalIdx = i + batchIdx;
            const filename = url.split('?')[0].split('/').pop() || `image-${globalIdx + 1}`;
            try {
              const res = await fetch(url);
              if (res.ok) folder.file(filename, await res.blob());
            } catch { /* skip failed images */ }
          }),
        );
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `order-${id.slice(0, 8)}-images.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast({ title: t('admin.common.error'), variant: 'destructive' });
    } finally {
      setDownloadingImages(false);
    }
  };

  if (isLoading) {
    return (
      <div className='p-6 space-y-4'>
        <Skeleton className='h-8 w-48' />
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <Skeleton className='h-64' />
          <div className='lg:col-span-2 space-y-4'>
            <Skeleton className='h-24' />
            <Skeleton className='h-48' />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className='p-6 text-center text-warm-gray'>{t('admin.common.error')}</div>
    );
  }

  const showTrackingFields = newStatus === 'shipped' || newStatus === 'delivered';

  return (
    <div className='p-6 space-y-6'>
      {/* Back + title */}
      <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
        <Button variant='ghost' size='sm' onClick={() => navigate('/supplier/orders')} className='gap-1'>
          <BackIcon size={16} />
          {dir === 'rtl' ? 'חזרה' : 'Back'}
        </Button>
        <h1 className='font-serif text-xl text-charcoal'>
          {t('supplier.orders.detail.title')} #{order.id.slice(-6)}
        </h1>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? ''}`}>
          {t(`orders.status.${order.status}`)}
        </span>
      </div>

      {/* Two-column layout */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Sidebar */}
        <div className='space-y-4'>
          {/* Client + shipping */}
          <div className='bg-white rounded-xl border border-border p-4 space-y-3'>
            <h3 className='font-medium text-charcoal text-sm'>{t('orders.client')}</h3>
            <p className='font-semibold text-charcoal'>{order.client.name}</p>

            {order.shippingAddress && (
              <div className='space-y-0.5 text-sm text-warm-gray'>
                <p className='font-medium text-charcoal text-xs uppercase tracking-wide mt-2 mb-1'>
                  {t('orders.shipping')}
                </p>
                {order.shippingAddress.name && <p>{order.shippingAddress.name}</p>}
                {order.shippingAddress.street && (
                  <p>{order.shippingAddress.street}{order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ''}</p>
                )}
                {order.shippingAddress.city && (
                  <p>{order.shippingAddress.city}{order.shippingAddress.zip ? ` ${order.shippingAddress.zip}` : ''}</p>
                )}
                {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
                {order.shippingAddress.phone && <p>{order.shippingAddress.phone}</p>}
              </div>
            )}
          </div>

          {/* Order meta */}
          <div className='bg-white rounded-xl border border-border p-4 space-y-2'>
            <div className={`flex justify-between text-sm ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <span className='text-warm-gray'>{t('orders.created')}</span>
              <span>{new Date(order.createdAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}</span>
            </div>
            {order.sentToSupplierAt && (
              <div className={`flex justify-between text-sm ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                <span className='text-warm-gray'>{dir === 'rtl' ? 'נשלח לספק' : 'Sent to supplier'}</span>
                <span>{new Date(order.sentToSupplierAt).toLocaleDateString(dir === 'rtl' ? 'he-IL' : 'en-GB')}</span>
              </div>
            )}
            {order.totalAmount != null && (
              <div className={`flex justify-between text-sm ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                <span className='text-warm-gray'>{t('orders.total')}</span>
                <span className='font-semibold'>₪{order.totalAmount.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Download images button */}
          <Button
            variant='outline'
            className='w-full gap-2'
            onClick={handleDownloadImages}
            disabled={downloadingImages}
          >
            <Download size={15} />
            {downloadingImages
              ? (dir === 'rtl' ? 'מוריד…' : 'Loading…')
              : t('supplier.orders.download_images')}
          </Button>
        </div>

        {/* Main content */}
        <div className='lg:col-span-2 space-y-4'>
          {/* Products list */}
          <div className='bg-white rounded-xl border border-border p-4 space-y-3'>
            <h3 className='font-medium text-charcoal'>{t('orders.items')}</h3>
            {order.items.map((item) => (
              <div key={item.id} className='border border-border rounded-lg p-3 space-y-1'>
                <div className={`flex items-start justify-between gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <div>
                    <p className='font-medium text-sm text-charcoal'>{item.product.name}</p>
                    <span className='text-xs text-warm-gray'>{item.product.type}</span>
                    {item.product.sku && (
                      <span className='text-xs text-warm-gray mx-2'>SKU: {item.product.sku}</span>
                    )}
                  </div>
                  <div className={`text-sm text-warm-gray text-right ${dir === 'rtl' ? 'text-left' : ''}`}>
                    <p>{t('orders.quantity')}: {item.quantity}</p>
                    {item.selectedImageIds.length > 0 && (
                      <p className='text-xs'>{item.selectedImageIds.length} {t('orders.photos.selected')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {(order.photographerNote || order.clientNote) && (
            <div className='bg-white rounded-xl border border-border p-4 space-y-3'>
              <h3 className='font-medium text-charcoal'>{dir === 'rtl' ? 'הערות' : 'Notes'}</h3>
              {order.photographerNote && (
                <div>
                  <p className='text-xs font-medium text-warm-gray mb-1'>{t('orders.note.photographer')}</p>
                  <p className='text-sm text-charcoal bg-ivory rounded-lg px-3 py-2'>{order.photographerNote}</p>
                </div>
              )}
              {order.clientNote && (
                <div>
                  <p className='text-xs font-medium text-warm-gray mb-1'>{t('orders.note.client')}</p>
                  <p className='text-sm text-charcoal bg-ivory rounded-lg px-3 py-2'>{order.clientNote}</p>
                </div>
              )}
            </div>
          )}

          {/* Tracking info (existing) */}
          {(order.trackingNumber || order.trackingCarrier) && (
            <div className='bg-white rounded-xl border border-border p-4 space-y-2'>
              <h3 className='font-medium text-charcoal'>{dir === 'rtl' ? 'מעקב משלוח' : 'Shipping Tracking'}</h3>
              {order.trackingCarrier && (
                <p className='text-sm text-warm-gray'>{t('orders.tracking.carrier')}: <span className='text-charcoal'>{order.trackingCarrier}</span></p>
              )}
              {order.trackingNumber && (
                <p className='text-sm text-warm-gray'>{t('orders.tracking')}: <span className='text-charcoal font-mono'>{order.trackingNumber}</span></p>
              )}
            </div>
          )}

          {/* Status update form */}
          {availableStatuses.length > 0 && (
            <div className='bg-white rounded-xl border border-border p-4 space-y-4'>
              <h3 className='font-medium text-charcoal'>{t('supplier.orders.update_status')}</h3>

              <div className='space-y-1.5'>
                <Label>{dir === 'rtl' ? 'סטטוס חדש' : 'New Status'}</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as SupplierStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder={dir === 'rtl' ? '— בחר סטטוס —' : '— Select status —'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{t(`orders.status.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showTrackingFields && (
                <>
                  <div className='space-y-1.5'>
                    <Label>{t('orders.tracking.carrier')}</Label>
                    <Input
                      value={trackingCarrier}
                      onChange={(e) => setTrackingCarrier(e.target.value)}
                      placeholder={dir === 'rtl' ? 'חברת שילוח' : 'e.g. Israel Post'}
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>{t('orders.tracking')}</Label>
                    <Input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder={dir === 'rtl' ? 'מספר מעקב' : 'Tracking number'}
                    />
                  </div>
                </>
              )}

              <div className='space-y-1.5'>
                <Label>{t('orders.note.supplier')}</Label>
                <Textarea
                  value={supplierNote}
                  onChange={(e) => setSupplierNote(e.target.value)}
                  placeholder={dir === 'rtl' ? 'הערה אופציונלית' : 'Optional note'}
                  rows={2}
                />
              </div>

              <Button
                className='bg-blush hover:bg-blush/90 text-white'
                onClick={handleUpdateStatus}
                disabled={!newStatus || updateStatus.isPending}
              >
                {updateStatus.isPending
                  ? (dir === 'rtl' ? 'מעדכן…' : 'Updating…')
                  : t('supplier.orders.update_status')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
