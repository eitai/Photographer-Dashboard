import { useEffect, useState } from 'react';
import { Package, Trash2, ChevronDown, ChevronUp, Link2, Check as CheckIcon, Download } from 'lucide-react';
import axios from 'axios';
import JSZip from 'jszip';
import { useI18n } from '@/lib/i18n';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import { fetchProductOrders, createProductOrder, deleteProductOrder, type ProductOrder } from '@/services/productOrderService';
import type { Gallery } from '@/types/gallery';

interface Props {
  clientId: string;
  clientName: string;
  galleries: Gallery[];
}

const TYPES = ['album', 'print'] as const;

const defaultForm = {
  name: '',
  type: 'album' as 'album' | 'print',
  maxPhotos: 20,
  allowedGalleryIds: [] as string[],
};

export const ProductOrdersSection = ({ clientId, clientName, galleries }: Props) => {
  const { t } = useI18n();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
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

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchProductOrders(clientId);
      setOrders(data);
    } catch {
      // silently ignore — section just shows empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [clientId]);

  // When type changes, auto-set sensible maxPhotos default
  const handleTypeChange = (type: 'album' | 'print') => {
    setForm((f) => ({ ...f, type, maxPhotos: type === 'print' ? 1 : 20 }));
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
      load();
    } catch {
      setError('Failed to create product order');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (order: ProductOrder) => {
    setDownloadingId(order._id);
    try {
      const zip = new JSZip();
      const folder = zip.folder(order.name) ?? zip;
      await Promise.all(
        order.selectedPhotoIds.map(async (photo) => {
          const res = await axios.get(`${API_BASE}${photo.path}`, { responseType: 'blob' });
          const ext = photo.filename.includes('.') ? `.${photo.filename.split('.').pop()}` : '';
          folder.file(`${photo.imageId}${ext}`, res.data);
        }),
      );
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `${order.name.replace(/\s+/g, '-')}.zip`;
      a.click();
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
      setOrders((prev) => prev.filter((o) => o._id !== orderId));
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
          {galleries.length > 0 && galleries[0]?.token && (
            <button
              onClick={handleCopyLink}
              className='flex items-center gap-1.5 text-xs text-warm-gray border border-beige rounded-lg px-3 py-1.5 hover:border-blush hover:text-blush transition-colors'
              title='Copy client product link'
            >
              {linkCopied ? (
                <>
                  <CheckIcon size={12} className='text-green-600' />
                  <span className='text-green-600'>Copied!</span>
                </>
              ) : (
                <>
                  <Link2 size={12} />
                  Client Link
                </>
              )}
            </button>
          )}
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setError('');
            }}
            className='text-sm text-blush hover:text-charcoal transition-colors flex items-center gap-1'
          >
            {showForm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {t('admin.products.add')}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className='border border-beige rounded-xl p-4 space-y-4 bg-ivory'>
          {/* Name */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.products.name_label')}</label>
            <input
              type='text'
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('admin.products.name_ph')}
              className='w-full border border-beige rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:border-blush'
            />
          </div>

          {/* Type */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.products.type_label')}</label>
            <div className='flex gap-3'>
              {TYPES.map((type) => (
                <label key={type} className='flex items-center gap-2 text-sm text-charcoal cursor-pointer'>
                  <input
                    type='radio'
                    name='product-type'
                    value={type}
                    checked={form.type === type}
                    onChange={() => handleTypeChange(type)}
                    className='accent-blush'
                  />
                  {typeLabel(type)}
                </label>
              ))}
            </div>
          </div>

          {/* Max photos */}
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
              className='px-4 py-2 bg-blush text-white text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60'
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
                        className='flex items-center gap-1 text-xs bg-blush text-primary-foreground px-2.5 py-1 rounded-lg hover:bg-blush/80 transition-colors disabled:opacity-60'
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
