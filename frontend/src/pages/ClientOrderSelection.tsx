import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { getOrderSelection, submitOrderSelection, getImageUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { GalleryImageForSelection, StoreOrderItem } from '@/lib/api';

interface SelectedState {
  [orderItemId: string]: string[];
}

interface ImageNotesState {
  [orderItemId: string]: Record<string, string>;
}

interface ShippingForm {
  name: string;
  street: string;
  apartment: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
}

export const ClientOrderSelection = () => {
  const { token } = useParams<{ token: string }>();
  const { t, dir } = useI18n();

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<SelectedState>({});
  const [imageNotes, setImageNotes] = useState<ImageNotesState>({});
  const [clientNote, setClientNote] = useState('');
  const [shipping, setShipping] = useState<ShippingForm>({
    name: '',
    street: '',
    apartment: '',
    city: '',
    zip: '',
    country: 'ישראל',
    phone: '',
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['orderSelection', token],
    queryFn: () => getOrderSelection(token ?? ''),
    enabled: !!token,
    retry: false,
  });

  const toggleImage = (itemId: string, imageId: string) => {
    setSelected((prev) => {
      const current = prev[itemId] ?? [];
      const next = current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId];
      return { ...prev, [itemId]: next };
    });
  };

  const setImageNote = (itemId: string, imageId: string, note: string) => {
    setImageNotes((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), [imageId]: note },
    }));
  };

  const handleSubmit = async () => {
    if (!data) return;
    if (!shipping.name.trim() || !shipping.street.trim() || !shipping.city.trim()) {
      setError(dir === 'rtl' ? 'יש למלא שם, רחוב ועיר' : 'Please fill in name, street and city');
      return;
    }
    // Per-product photo count requirements
    for (const item of data.order.items) {
      const count = (selected[item.id] ?? []).length;
      const min = item.product.minPhotos ?? 0;
      const max = item.product.maxPhotos ?? 0;
      if (min > 0 && count < min) {
        setError(
          (dir === 'rtl'
            ? t('store.photos_min_only').replace('{min}', String(min))
            : t('store.photos_min_only').replace('{min}', String(min))) + ` — ${item.product.name}`
        );
        return;
      }
      if (max > 0 && count > max) {
        setError(t('store.photos_max_only').replace('{max}', String(max)) + ` — ${item.product.name}`);
        return;
      }
    }
    setError('');
    setSubmitting(true);

    try {
      await submitOrderSelection(token ?? '', {
        items: data.order.items.map((item) => ({
          orderItemId: item.id,
          selectedImageIds: selected[item.id] ?? [],
          imageNotes: imageNotes[item.id] ?? {},
        })),
        shippingAddress: {
          name: shipping.name.trim(),
          street: shipping.street.trim(),
          apartment: shipping.apartment.trim() || undefined,
          city: shipping.city.trim(),
          zip: shipping.zip.trim() || undefined,
          country: shipping.country.trim() || undefined,
          phone: shipping.phone.trim() || undefined,
        },
        clientNote: clientNote.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      setError(dir === 'rtl' ? 'אירעה שגיאה. אנא נסה שנית.' : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div data-theme="bw" className='min-h-screen bg-ivory flex items-center justify-center'>
        <div className='w-full max-w-2xl p-6 space-y-4'>
          <Skeleton className='h-10 w-64 mx-auto' />
          <Skeleton className='h-48 w-full' />
          <Skeleton className='h-48 w-full' />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div data-theme="bw" className='min-h-screen bg-ivory flex items-center justify-center'>
        <div className='text-center space-y-3 p-6'>
          <h1 className='font-serif text-2xl text-charcoal'>{t('gallery.not_found')}</h1>
          <p className='text-warm-gray'>{t('gallery.link_expired')}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div data-theme="bw" className='min-h-screen bg-ivory flex items-center justify-center'>
        <div className='text-center space-y-4 p-6 max-w-md'>
          <div className='text-5xl'>🤍</div>
          <h1 className='font-serif text-3xl text-charcoal'>{t('selection.submitted.title')}</h1>
          <p className='text-warm-gray'>{t('selection.submitted.body')}</p>
        </div>
      </div>
    );
  }

  const { order, galleryImages } = data;

  return (
    <div data-theme="bw" className='min-h-screen bg-ivory' dir={dir}>
      <div className='max-w-3xl mx-auto px-4 py-10 space-y-10'>
        {/* Header */}
        <div className='text-center space-y-2'>
          <h1 className='font-serif text-3xl text-charcoal'>{t('selection.title')}</h1>
          <p className='text-warm-gray'>{t('selection.subtitle')}</p>
          <p className='text-sm text-warm-gray'>{order.gallery?.name ?? ''}</p>
        </div>

        {/* Items */}
        {order.items.map((item) => (
          <ItemSelectionSection
            key={item.id}
            item={item}
            galleryImages={galleryImages}
            selectedIds={selected[item.id] ?? []}
            notes={imageNotes[item.id] ?? {}}
            onToggle={(imgId) => toggleImage(item.id, imgId)}
            onNoteChange={(imgId, note) => setImageNote(item.id, imgId, note)}
            dir={dir}
          />
        ))}

        {/* Shipping form */}
        <div className='bg-white rounded-xl border border-border p-6 space-y-4'>
          <h2 className='font-serif text-xl text-charcoal'>{t('selection.shipping.title')}</h2>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='space-y-1.5 sm:col-span-2'>
              <Label>{t('selection.shipping.name')} *</Label>
              <Input
                value={shipping.name}
                onChange={(e) => setShipping((s) => ({ ...s, name: e.target.value }))}
                placeholder={t('selection.shipping.name')}
              />
            </div>

            <div className='space-y-1.5'>
              <Label>{t('selection.shipping.street')} *</Label>
              <Input
                value={shipping.street}
                onChange={(e) => setShipping((s) => ({ ...s, street: e.target.value }))}
                placeholder={t('selection.shipping.street')}
              />
            </div>

            <div className='space-y-1.5'>
              <Label>{t('selection.shipping.apartment')}</Label>
              <Input
                value={shipping.apartment}
                onChange={(e) => setShipping((s) => ({ ...s, apartment: e.target.value }))}
                placeholder={t('selection.shipping.apartment')}
              />
            </div>

            <div className='space-y-1.5'>
              <Label>{t('selection.shipping.city')} *</Label>
              <Input
                value={shipping.city}
                onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))}
                placeholder={t('selection.shipping.city')}
              />
            </div>

            <div className='space-y-1.5'>
              <Label>{t('selection.shipping.zip')}</Label>
              <Input
                value={shipping.zip}
                onChange={(e) => setShipping((s) => ({ ...s, zip: e.target.value }))}
                placeholder={t('selection.shipping.zip')}
              />
            </div>

            <div className='space-y-1.5'>
              <Label>{t('selection.shipping.country')}</Label>
              <Input
                value={shipping.country}
                onChange={(e) => setShipping((s) => ({ ...s, country: e.target.value }))}
                placeholder={t('selection.shipping.country')}
              />
            </div>

            <div className='space-y-1.5'>
              <Label>{t('selection.shipping.phone')}</Label>
              <Input
                value={shipping.phone}
                onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))}
                placeholder={t('selection.shipping.phone')}
                type='tel'
              />
            </div>
          </div>
        </div>

        {/* Client note */}
        <div className='space-y-1.5'>
          <Label>{t('orders.note.client')}</Label>
          <Textarea
            value={clientNote}
            onChange={(e) => setClientNote(e.target.value)}
            placeholder={dir === 'rtl' ? 'הערה אופציונלית לצלם…' : 'Optional note to the photographer…'}
            rows={3}
          />
        </div>

        {error && <p className='text-red-500 text-sm text-center'>{error}</p>}

        {/* Submit */}
        <Button
          className='w-full bg-blush hover:bg-blush/90 text-white py-3 text-base font-medium'
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (dir === 'rtl' ? 'שולח…' : 'Submitting…') : t('selection.submit')}
        </Button>
      </div>
    </div>
  );
};

// Sub-component: image selection grid for a single order item
interface ItemSelectionSectionProps {
  item: StoreOrderItem;
  galleryImages: GalleryImageForSelection[];
  selectedIds: string[];
  notes: Record<string, string>;
  onToggle: (imageId: string) => void;
  onNoteChange: (imageId: string, note: string) => void;
  dir: 'rtl' | 'ltr';
}

const ItemSelectionSection = ({
  item,
  galleryImages,
  selectedIds,
  notes,
  onToggle,
  onNoteChange,
  dir,
}: ItemSelectionSectionProps) => {
  const { t } = useI18n();
  const minPhotos = item.product.minPhotos ?? 0;
  const maxPhotos = item.product.maxPhotos ?? 0;
  const atMax = maxPhotos > 0 && selectedIds.length >= maxPhotos;
  const countOk = selectedIds.length >= minPhotos && (maxPhotos === 0 || selectedIds.length <= maxPhotos);
  const requirementText =
    minPhotos > 0 && maxPhotos > 0
      ? t('store.photos_requirement').replace('{min}', String(minPhotos)).replace('{max}', String(maxPhotos))
      : minPhotos > 0
      ? t('store.photos_min_only').replace('{min}', String(minPhotos))
      : maxPhotos > 0
      ? t('store.photos_max_only').replace('{max}', String(maxPhotos))
      : null;

  return (
    <div className='bg-white rounded-xl border border-border p-6 space-y-4'>
      <div className={`flex items-start justify-between gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
        <div>
          <h2 className='font-serif text-lg text-charcoal'>{item.product.name}</h2>
          <p className='text-warm-gray text-sm'>{item.product.type} — ×{item.quantity}</p>
          {requirementText && (
            <p className={`text-xs mt-0.5 ${countOk ? 'text-muted-foreground' : 'text-flag-ink font-medium'}`}>
              {requirementText}
            </p>
          )}
        </div>
        <span className='text-sm font-medium text-blush whitespace-nowrap'>
          {selectedIds.length} {dir === 'rtl' ? 'נבחרו' : 'selected'}
        </span>
      </div>

      {galleryImages.length === 0 ? (
        <p className='text-warm-gray text-sm text-center py-8'>{dir === 'rtl' ? 'אין תמונות זמינות' : 'No images available'}</p>
      ) : (
        <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
          {galleryImages.map((img) => {
            const isSelected = selectedIds.includes(img.id);
            return (
              <div key={img.id} className='relative group'>
                <button
                  type='button'
                  onClick={() => onToggle(img.id)}
                  disabled={!isSelected && atMax}
                  className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blush ${
                    isSelected ? 'border-blush shadow-md' : 'border-transparent hover:border-zinc-300'
                  } ${!isSelected && atMax ? 'opacity-40 cursor-not-allowed' : ''}`}
                  aria-label={`${isSelected ? 'Deselect' : 'Select'} image ${img.filename}`}
                >
                  <img
                    src={getImageUrl(img.thumbnailPath || img.path)}
                    alt={img.filename}
                    className='w-full h-full object-cover'
                    loading='lazy'
                  />
                  {isSelected && (
                    <div className='absolute inset-0 bg-blush/20 flex items-center justify-center'>
                      <div className='bg-blush rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold'>
                        ✓
                      </div>
                    </div>
                  )}
                </button>
                {isSelected && (
                  <input
                    type='text'
                    className='mt-1 w-full text-xs border border-zinc-200 rounded px-1.5 py-1 focus:outline-none focus:border-blush'
                    placeholder={dir === 'rtl' ? 'הערה…' : 'Note…'}
                    value={notes[img.id] ?? ''}
                    onChange={(e) => onNoteChange(img.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
