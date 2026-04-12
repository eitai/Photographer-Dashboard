import { useState } from 'react';
import { Package, Trash2, ChevronUp, Download, Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { API_BASE } from '@/lib/api';
import { downloadZip } from '@/lib/downloadZip';
import { createProductOrder, deleteProductOrder, type ProductOrder } from '@/services/productOrderService';
import { useProductOrders, useAdminProducts, type AdminProduct } from '@/hooks/useQueries';
import type { Gallery } from '@/types/gallery';

interface Props {
  clientId: string;
  clientName: string;
  galleries: Gallery[];
}

const defaultForm = {
  name: '',
  type: 'album' as 'album' | 'print',
  maxPhotos: 20,
  allowedGalleryIds: [] as string[],
};

export const ProductOrdersSection = ({ clientId, clientName, galleries }: Props) => {
  const { t } = useI18n();
  const { data: orders = [], isLoading: loading, refetch } = useProductOrders(clientId);
  const { data: catalogProducts = [] } = useAdminProducts();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    const token = galleries[0]?.token;
    if (!token) return;
    const url = `${window.location.origin}/products/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const toggleGallery = (galleryId: string) => {
    setForm((f) => {
      const ids = f.allowedGalleryIds.includes(galleryId)
        ? f.allowedGalleryIds.filter((id) => id !== galleryId)
        : [...f.allowedGalleryIds, galleryId];
      return { ...f, allowedGalleryIds: ids };
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (form.allowedGalleryIds.length === 0) {
      setError('Select at least one gallery');
      return;
    }
    setCreating(true);
    try {
      await createProductOrder({
        clientId,
        name: form.name.trim(),
        type: form.type,
        maxPhotos: form.maxPhotos,
        allowedGalleryIds: form.allowedGalleryIds,
      });
      setForm({ ...defaultForm });
      setShowForm(false);
      refetch();
    } catch {
      setError('Failed to create product order');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (order: ProductOrder) => {
    setDownloadingId(order._id);
    try {
      await downloadZip(
        order.selectedPhotoIds.map((photo) => ({
          _id: photo.imageId,
          path: photo.path,
          filename: photo.filename,
        })),
        order.name,
        order.name.replace(/\s+/g, '-'),
      );
    } catch {
      /* ignore */
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (orderId: string) => {
    setDeletingId(orderId);
    try {
      await deleteProductOrder(orderId);
      refetch();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  const typeLabel = (type: 'album' | 'print') => (type === 'album' ? t('admin.products.type_album') : t('admin.products.type_print'));

  return (
    <section className='bg-card rounded-2xl border border-beige p-6 space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between flex-wrap gap-2'>
        <h2 className=' text-lg text-charcoal flex items-center gap-2'>
          <Package size={18} className='text-blush' />
          {t('admin.products.title')}
        </h2>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setError('');
            }}
            className='text-sm text-blush hover:text-charcoal transition-colors flex items-center gap-1'
          >
            {showForm ? <ChevronUp size={15} /> : <Plus size={15} />}
            {t('admin.products.add')}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className='border border-beige rounded-xl p-4 space-y-4 bg-ivory'>
          {/* Product — dropdown from catalog */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.products.name_label')}</label>
            <select
              value={form.name}
              onChange={(e) => {
                const p = catalogProducts.find((p: AdminProduct) => p.name === e.target.value);
                if (p) setForm((f) => ({ ...f, name: p.name, type: p.type, maxPhotos: p.maxPhotos }));
                else setForm((f) => ({ ...f, name: e.target.value }));
              }}
              required
              className='w-full border border-beige rounded-lg px-3 py-2 text-sm text-charcoal bg-card focus:outline-none focus:border-blush'
            >
              <option value='' disabled>{t('admin.products.catalog_pick')}</option>
              {catalogProducts.map((p: AdminProduct) => (
                <option key={p.id} value={p.name}>
                  {p.name} — {t(`admin.products.type_${p.type}`)} · {p.maxPhotos} {t('admin.products.max_photos')}
                </option>
              ))}
            </select>
          </div>

          {/* Max photos (editable override) */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.products.max_photos')}</label>
            <input
              type='number'
              min={1}
              max={500}
              value={form.maxPhotos}
              onChange={(e) => setForm((f) => ({ ...f, maxPhotos: Number(e.target.value) }))}
              className='w-28 border border-beige rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:border-blush'
            />
          </div>

          {/* Allowed galleries */}
          <div>
            <label className='block text-xs text-warm-gray mb-2'>{t('admin.products.galleries_label')}</label>
            {galleries.length === 0 ? (
              <p className='text-xs text-warm-gray'>{t('admin.products.no_galleries')}</p>
            ) : (
              <div className='space-y-1.5'>
                {galleries.map((g) => (
                  <label key={g._id} className='flex items-center gap-2 text-sm text-charcoal cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={form.allowedGalleryIds.includes(g._id)}
                      onChange={() => toggleGallery(g._id)}
                      className='accent-blush rounded'
                    />
                    {g.name}
                    {g.isDelivery && (
                      <span className='text-[10px] bg-blush/20 text-blush px-1.5 py-0.5 rounded-full'>
                        {t('admin.products.delivery_badge')}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className='text-xs text-red-500'>{error}</p>}

          <div className='flex gap-3'>
            <button
              type='submit'
              disabled={creating}
              className='px-4 py-2 bg-blush text-white text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60'
            >
              {creating ? t('admin.products.creating') : t('admin.products.create')}
            </button>
            <button
              type='button'
              onClick={() => {
                setShowForm(false);
                setError('');
                setForm({ ...defaultForm });
              }}
              className='px-4 py-2 text-sm text-warm-gray hover:text-charcoal'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Orders list */}
      {loading ? (
        <p className='text-sm text-warm-gray'>{t('admin.common.loading')}</p>
      ) : orders.length === 0 ? (
        <p className='text-sm text-warm-gray'>{t('admin.products.no_orders')}</p>
      ) : (
        <div className='space-y-3'>
          {orders.map((order) => (
            <div key={order._id} className='flex items-start justify-between gap-4 border border-beige rounded-xl px-4 py-3'>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className='font-medium text-sm text-charcoal'>{order.name}</span>
                  <span className='text-[11px] bg-ivory text-warm-gray border border-beige px-2 py-0.5 rounded-full'>
                    {typeLabel(order.type)}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      order.status === 'submitted'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-ivory text-warm-gray border border-beige'
                    }`}
                  >
                    {order.status === 'submitted' ? t('admin.products.status_submitted') : t('admin.products.status_pending')}
                  </span>
                </div>

                <p className='text-xs text-warm-gray mt-1'>
                  {order.maxPhotos} {t('admin.products.max_photos')}
                  {' · '}
                  {order.allowedGalleryIds.map((g) => g.name).join(', ')}
                </p>

                {order.status === 'submitted' && order.selectedPhotoIds.length > 0 && (
                  <div className='mt-3'>
                    <div className='flex items-center gap-3 mb-2'>
                      <p className='text-xs text-green-700'>
                        {order.selectedPhotoIds.length} {t('admin.products.photos_chosen')}
                      </p>
                      <button
                        onClick={() => handleDownload(order)}
                        disabled={downloadingId === order._id}
                        className='flex items-center gap-1 text-xs bg-blush text-primary-foreground px-2.5 py-1 rounded-xl hover:bg-blush/80 transition-colors disabled:opacity-60'
                      >
                        <Download size={11} />
                        {downloadingId === order._id ? 'Downloading...' : 'Download All'}
                      </button>
                    </div>
                    <div className='grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5'>
                      {order.selectedPhotoIds.map((photo) => (
                        <a
                          key={photo.imageId}
                          href={`${API_BASE}${photo.path}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='aspect-square rounded-md overflow-hidden bg-beige block hover:opacity-80 transition-opacity'
                          title={photo.filename}
                        >
                          <img
                            src={`${API_BASE}${photo.thumbnailPath || photo.path}`}
                            alt={photo.filename}
                            className='w-full h-full object-cover'
                            loading='lazy'
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDelete(order._id)}
                disabled={deletingId === order._id}
                className='shrink-0 text-warm-gray hover:text-red-500 transition-colors disabled:opacity-50'
                title={t('admin.products.delete')}
              >
                {deletingId === order._id ? <span className='text-xs'>{t('admin.common.deleting')}</span> : <Trash2 size={15} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
