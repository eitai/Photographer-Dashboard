import { useState } from 'react';
import { Package, Trash2, Download, Plus, Link as LinkIcon, Mail, Check, Copy, Pencil, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n';
import { SESSION_TYPE_KEYS } from '@/components/admin/SessionTypeCombobox';
import { getImageUrl } from '@/lib/api';
import { downloadZip } from '@/lib/downloadZip';
import {
  createProductOrder,
  deleteProductOrder,
  toggleProductOrderLink,
  sendProductOrderLinksEmail,
  type ProductOrder,
} from '@/services/productOrderService';
import { useProductOrders, useAdminProducts, useUpdateProductOrderGalleries, useDeliverProductOrder, type AdminProduct } from '@/hooks/useQueries';
import type { Gallery } from '@/types/gallery';

interface Props {
  clientId: string;
  clientName: string;
  galleries: Gallery[];
  clientEmail?: string;
}

const defaultForm = {
  name: '',
  type: 'album' as 'album' | 'print',
  maxPhotos: 20,
};

export const ProductOrdersSection = ({ clientId, clientName, galleries, clientEmail }: Props) => {
  const { t } = useI18n();
  const tGallery = (name: string) => {
    if (!SESSION_TYPE_KEYS.includes(name)) return name;
    const translated = t(`admin.session.${name}`);
    return translated.startsWith('admin.session.') ? name : translated;
  };
  const { data: orders = [], isLoading: loading, refetch } = useProductOrders(clientId);
  const { data: catalogProducts = [] } = useAdminProducts();
  const updateGalleries = useUpdateProductOrderGalleries(clientId);
  const deliverOrder = useDeliverProductOrder(clientId);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [togglingLinkId, setTogglingLinkId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [editingGalleriesFor, setEditingGalleriesFor] = useState<string | null>(null);
  const [galleryDraft, setGalleryDraft] = useState<Record<string, string[]>>({});
  const [savingGalleries, setSavingGalleries] = useState(false);
  const [galleryError, setGalleryError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError(t('admin.products.name_required'));
      return;
    }
    setCreating(true);
    try {
      await createProductOrder({
        clientId,
        name: form.name.trim(),
        type: form.type,
        maxPhotos: form.maxPhotos,
        allowedGalleryIds: galleries.map((g) => g._id),
      });
      setForm({ ...defaultForm });
      setShowForm(false);
      refetch();
    } catch {
      setError(t('admin.products.create_failed'));
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

  const openGalleryEditor = (order: ProductOrder) => {
    const currentIds = (order.allowedGalleryIds as Array<{ _id: string } | string>).map((g) =>
      typeof g === 'string' ? g : g._id
    );
    setGalleryDraft((d) => ({ ...d, [order._id]: currentIds }));
    setGalleryError('');
    setEditingGalleriesFor(order._id);
  };

  const toggleGalleryInDraft = (orderId: string, galleryId: string) => {
    setGalleryDraft((d) => {
      const current = d[orderId] || [];
      return {
        ...d,
        [orderId]: current.includes(galleryId)
          ? current.filter((id) => id !== galleryId)
          : [...current, galleryId],
      };
    });
  };

  const saveGalleryDraft = async (orderId: string) => {
    setSavingGalleries(true);
    setGalleryError('');
    try {
      await updateGalleries.mutateAsync({ orderId, allowedGalleryIds: galleryDraft[orderId] || [] });
      setEditingGalleriesFor(null);
    } catch {
      setGalleryError(t('admin.products.gallery_save_error'));
    } finally {
      setSavingGalleries(false);
    }
  };

  const typeLabel = (type: 'album' | 'print') => (type === 'album' ? t('admin.products.type_album') : t('admin.products.type_print'));

  const hasEnabledLinks = orders.some((o) => o.linkEnabled);

  return (
    <>
    <section className='bg-card rounded-2xl border border-beige flex flex-col max-h-[560px] shadow-[1px_1px_5px_rgba(0,0,0,0.4)]'>
      {/* Header — pinned */}
      <div className='flex items-center justify-between flex-wrap gap-2 px-6 py-4 shrink-0 border-b border-beige'>
        <h2 className=' text-lg text-charcoal flex items-center gap-2'>
          <Package size={18} className='text-blush' />
          {t('admin.products.title')}
          {orders.length > 0 && (
            <span className='text-[11px] bg-blush/20 text-blush px-2 py-0.5 rounded-full font-medium'>
              {orders.length}
            </span>
          )}
        </h2>
        <div className='flex items-center gap-3'>
          {clientEmail && hasEnabledLinks && (
            <button
              onClick={async () => {
                setSendingEmail(true);
                setEmailSent(false);
                try {
                  await sendProductOrderLinksEmail({ clientId, clientName, clientEmail });
                  setEmailSent(true);
                  setTimeout(() => setEmailSent(false), 3000);
                } catch {
                  /* ignore */
                } finally {
                  setSendingEmail(false);
                }
              }}
              disabled={sendingEmail}
              className='flex items-center gap-1 text-sm text-warm-gray hover:text-charcoal transition-colors disabled:opacity-50 cursor-pointer'
            >
              {emailSent ? <Check size={14} className='text-green-500' /> : <Mail size={14} />}
              {emailSent ? t('admin.products.email_sent') : sendingEmail ? t('admin.common.saving') : t('admin.products.send_links_email')}
            </button>
          )}
          <button
            onClick={() => { setShowForm(true); setError(''); }}
            className='text-sm text-blush hover:text-charcoal transition-colors flex items-center gap-1 cursor-pointer'
          >
            <Plus size={15} />
            {t('admin.products.add')}
          </button>
        </div>
      </div>

      {/* Orders list — scrollable */}
      <div className='flex-1 overflow-y-auto px-6 py-4 space-y-3'>
      {loading ? (
        <p className='text-sm text-warm-gray'>{t('admin.common.loading')}</p>
      ) : orders.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-8 text-center gap-2'>
          <Package size={28} className='text-beige' />
          <p className='text-sm text-warm-gray'>{t('admin.products.no_orders')}</p>
          <button
            onClick={() => { setShowForm(true); setError(''); }}
            className='text-xs text-blush hover:text-blush/80 transition-colors cursor-pointer'
          >
            + {t('admin.products.add')}
          </button>
        </div>
      ) : (
        <>
          {orders.map((order) => (
            <div key={order._id} className={`rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-sm ${
                order.status === 'submitted'
                  ? 'border-amber-300 hover:border-amber-400'
                  : order.status === 'delivered'
                  ? 'border-green-300 hover:border-green-400'
                  : 'border-beige hover:border-blush/40'
              }`}>
              <div className='divide-y divide-beige'>

                {/* Section 1 — Header */}
                <div className='px-4 py-3 flex items-start gap-2'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span className='font-medium text-sm text-charcoal'>{order.name}</span>
                      <span className='text-[11px] bg-ivory text-warm-gray border border-beige px-2 py-0.5 rounded-full'>
                        {typeLabel(order.type)}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          order.status === 'submitted'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : order.status === 'delivered'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-ivory text-warm-gray border border-beige'
                        }`}
                      >
                        {order.status === 'submitted'
                          ? t('admin.products.status_submitted')
                          : order.status === 'delivered'
                          ? t('admin.products.status_delivered')
                          : t('admin.products.status_pending')}
                      </span>
                    </div>
                    <p className='text-xs text-warm-gray mt-1'>
                      {order.maxPhotos} {t('admin.products.max_photos')}
                    </p>
                    {order.status === 'submitted' && (
                      <button
                        onClick={async () => {
                          setDeliveringId(order._id);
                          try {
                            await deliverOrder.mutateAsync(order._id);
                          } catch { /* ignore */ }
                          finally { setDeliveringId(null); }
                        }}
                        disabled={deliveringId === order._id}
                        className='mt-1.5 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-60 cursor-pointer'
                      >
                        <Check size={10} />
                        {deliveringId === order._id ? t('admin.common.saving') : t('admin.products.mark_delivered')}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(order._id)}
                    disabled={deletingId === order._id}
                    className='shrink-0 text-warm-gray hover:text-red-500 transition-colors disabled:opacity-50 ms-auto cursor-pointer'
                    title={t('admin.products.delete')}
                  >
                    {deletingId === order._id ? <span className='text-xs'>{t('admin.common.deleting')}</span> : <Trash2 size={15} />}
                  </button>
                </div>

                {/* Section 2 — Galleries */}
                <div className='px-4 py-3 bg-ivory/40'>
                  <p className='text-[11px] font-medium text-warm-gray uppercase tracking-wide mb-1'>
                    {t('admin.products.galleries_section_label')}
                  </p>
                  {order.status !== 'submitted' ? (
                    <div className='flex items-start gap-2 flex-wrap'>
                      {Array.isArray(order.allowedGalleryIds) && order.allowedGalleryIds.length > 0 ? (
                        <div className='flex flex-wrap gap-1 mt-1'>
                          {(order.allowedGalleryIds as Array<{ _id: string; name: string } | string>).map((g) => {
                            const name = tGallery(typeof g === 'string' ? g : g.name);
                            const key = typeof g === 'string' ? g : g._id;
                            return (
                              <span key={key} className='text-[11px] bg-beige/60 text-warm-gray px-2 py-0.5 rounded-full border border-beige'>
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className='text-[11px] text-warm-gray/60 italic'>{t('admin.products.no_galleries_selected')}</span>
                      )}
                      <button
                        onClick={() =>
                          editingGalleriesFor === order._id
                            ? setEditingGalleriesFor(null)
                            : openGalleryEditor(order)
                        }
                        className='text-[11px] text-blush hover:text-blush/80 transition-colors flex items-center gap-1 cursor-pointer'
                      >
                        <Pencil size={9} />
                        {t('admin.products.edit_galleries')}
                      </button>
                    </div>
                  ) : (
                    <div>
                      {Array.isArray(order.allowedGalleryIds) && order.allowedGalleryIds.length > 0 ? (
                        <div className='flex flex-wrap gap-1 mt-1'>
                          {(order.allowedGalleryIds as Array<{ _id: string; name: string } | string>).map((g) => {
                            const name = tGallery(typeof g === 'string' ? g : g.name);
                            const key = typeof g === 'string' ? g : g._id;
                            return (
                              <span key={key} className='text-[11px] bg-beige/60 text-warm-gray px-2 py-0.5 rounded-full border border-beige'>
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className='text-[11px] text-warm-gray/60 italic'>{t('admin.products.no_galleries_selected')}</span>
                      )}
                    </div>
                  )}

                  {/* Inline gallery picker */}
                  {editingGalleriesFor === order._id && (
                    <div className='mt-2 border border-beige rounded-lg p-3 bg-ivory space-y-2'>
                      {galleries.length === 0 ? (
                        <p className='text-xs text-warm-gray'>{t('admin.products.no_galleries')}</p>
                      ) : (
                        <ul className='max-h-48 overflow-y-auto space-y-1 pe-1'>
                          {galleries.map((g) => (
                            <li key={g._id} className='flex items-center gap-2'>
                              <input
                                type='checkbox'
                                id={`gallery-${order._id}-${g._id}`}
                                checked={(galleryDraft[order._id] || []).includes(g._id)}
                                onChange={() => toggleGalleryInDraft(order._id, g._id)}
                                className='accent-blush'
                              />
                              <label htmlFor={`gallery-${order._id}-${g._id}`} className='text-xs text-charcoal cursor-pointer'>
                                {tGallery(g.name)}
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                      {galleryError && <p className='text-xs text-red-500'>{galleryError}</p>}
                      <div className='flex items-center gap-2 pt-1'>
                        <button
                          onClick={() => saveGalleryDraft(order._id)}
                          disabled={savingGalleries}
                          className='text-xs px-3 py-1 bg-blush text-white rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer'
                        >
                          {savingGalleries ? t('admin.common.saving') : t('admin.common.done')}
                        </button>
                        <button
                          onClick={() => { setEditingGalleriesFor(null); setGalleryError(''); }}
                          className='text-xs text-warm-gray hover:text-charcoal transition-colors cursor-pointer'
                        >
                          {t('admin.common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3 — Link */}
                <div className='px-4 py-3'>
                  <p className='text-[11px] font-medium text-warm-gray uppercase tracking-wide mb-1.5'>
                    {t('admin.products.link_label')}
                  </p>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <button
                      onClick={async () => {
                        setTogglingLinkId(order._id);
                        try {
                          await toggleProductOrderLink(order._id, !order.linkEnabled);
                          refetch();
                        } catch {
                          /* ignore */
                        } finally {
                          setTogglingLinkId(null);
                        }
                      }}
                      disabled={togglingLinkId === order._id}
                      className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                        order.linkEnabled
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-ivory text-warm-gray border-beige hover:border-blush hover:text-charcoal'
                      }`}
                    >
                      <LinkIcon size={10} />
                      {order.linkEnabled ? t('admin.products.link_on') : t('admin.products.link_off')}
                    </button>

                    {order.linkEnabled && order.token && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/products/order/${order.token}`;
                          navigator.clipboard.writeText(url).then(() => {
                            setCopiedOrderId(order._id);
                            setTimeout(() => setCopiedOrderId(null), 2000);
                          });
                        }}
                        className='flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-ivory text-warm-gray border-beige hover:border-blush hover:text-charcoal transition-colors cursor-pointer'
                      >
                        {copiedOrderId === order._id ? <Check size={10} className='text-green-500' /> : <Copy size={10} />}
                        {copiedOrderId === order._id ? t('admin.client.copied') : t('admin.products.copy_link')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Section 4 — Selected photos (only when submitted + has photos) */}
                {order.status === 'submitted' && order.selectedPhotoIds.length > 0 && (
                  <div className='px-4 py-3'>
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
                          href={getImageUrl(photo.path)}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='aspect-square rounded-md overflow-hidden bg-beige block hover:opacity-80 transition-opacity'
                          title={photo.filename}
                        >
                          <img
                            src={getImageUrl(photo.thumbnailPath || photo.path)}
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
            </div>
          ))}
        </>
      )}
      </div>
    </section>

    {/* Add product modal */}
    <Modal isOpen={showForm} onClose={() => { setShowForm(false); setError(''); setForm({ ...defaultForm }); }} maxWidth='max-w-sm'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-base font-semibold text-charcoal'>{t('admin.products.add')}</h3>
        <button
          onClick={() => { setShowForm(false); setError(''); setForm({ ...defaultForm }); }}
          className='text-warm-gray hover:text-charcoal transition-colors cursor-pointer'
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleCreate} className='space-y-4'>
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

        {error && <p className='text-xs text-red-500'>{error}</p>}

        <div className='flex gap-3 pt-1'>
          <button
            type='submit'
            disabled={creating}
            className='flex-1 px-4 py-2 bg-blush text-white text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer'
          >
            {creating ? t('admin.products.creating') : t('admin.products.create')}
          </button>
          <button
            type='button'
            onClick={() => { setShowForm(false); setError(''); setForm({ ...defaultForm }); }}
            className='px-4 py-2 text-sm text-warm-gray hover:text-charcoal transition-colors cursor-pointer'
          >
            {t('admin.common.cancel')}
          </button>
        </div>
      </form>
    </Modal>
    </>
  );
};
