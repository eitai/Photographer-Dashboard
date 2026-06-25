import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useClients, useGalleriesByClient, useCreateOrder, useAdminSupplierProducts } from '@/hooks/useQueries';
import type { AdminSupplierProduct } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface ProductRow {
  productId: string;
  quantity: number;
  unitCostPrice: number | null;
  unitClientPrice: number | null;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClientId?: string;
  defaultGalleryId?: string;
}

export const CreateOrderModal = ({ isOpen, onClose, defaultClientId, defaultGalleryId }: CreateOrderModalProps) => {
  const { t, dir } = useI18n();
  const { toast } = useToast();

  const [clientId, setClientId] = useState(defaultClientId ?? '');
  const [galleryId, setGalleryId] = useState(defaultGalleryId ?? '');
  const [photographerNote, setPhotographerNote] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([{ productId: '', quantity: 1, unitCostPrice: null, unitClientPrice: null }]);

  const { data: clients = [] } = useClients();
  const { data: galleries = [] } = useGalleriesByClient(clientId);
  const { data: supplierProducts = [], isLoading: productsLoading } = useAdminSupplierProducts();
  const createOrder = useCreateOrder();

  const addProduct = () =>
    setProducts((prev) => [...prev, { productId: '', quantity: 1, unitCostPrice: null, unitClientPrice: null }]);

  const removeProduct = (idx: number) =>
    setProducts((prev) => prev.filter((_, i) => i !== idx));

  const updateQuantity = (idx: number, value: number) =>
    setProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, quantity: value } : p)),
    );

  const favoriteProducts = supplierProducts.filter((sp: AdminSupplierProduct) => sp.isFavorite);
  const otherProducts = supplierProducts.filter((sp: AdminSupplierProduct) => !sp.isFavorite);

  const selectProduct = (idx: number, productId: string) => {
    const found = supplierProducts.find((sp: AdminSupplierProduct) => sp.id === productId);
    setProducts((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              productId,
              unitCostPrice: found?.costPrice ?? null,
              unitClientPrice: found?.clientPrice ?? null,
            }
          : p,
      ),
    );
  };

  const handleSubmit = () => {
    if (!clientId || !galleryId) {
      toast({ title: dir === 'rtl' ? 'יש לבחור לקוח וגלריה' : 'Please select a client and gallery', variant: 'destructive' });
      return;
    }
    const validProducts = products.filter((p) => p.productId.trim());
    if (validProducts.length === 0) {
      toast({ title: dir === 'rtl' ? 'יש להוסיף לפחות מוצר אחד' : 'Add at least one product', variant: 'destructive' });
      return;
    }

    createOrder.mutate(
      {
        clientId,
        galleryId,
        photographerNote: photographerNote.trim() || undefined,
        items: validProducts.map((p) => ({ productId: p.productId, quantity: p.quantity })),
      },
      {
        onSuccess: () => {
          toast({ title: dir === 'rtl' ? 'ההזמנה נוצרה בהצלחה' : 'Order created successfully' });
          handleClose();
        },
        onError: () =>
          toast({ title: t('admin.common.error'), variant: 'destructive' }),
      },
    );
  };

  const handleClose = () => {
    setClientId(defaultClientId ?? '');
    setGalleryId(defaultGalleryId ?? '');
    setPhotographerNote('');
    setProducts([{ productId: '', quantity: 1, unitCostPrice: null, unitClientPrice: null }]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className='max-w-lg' dir={dir}>
        <DialogHeader>
          <DialogTitle className='font-serif text-charcoal'>{t('orders.new')}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* Client selector */}
          <div className='space-y-1.5'>
            <Label>{t('orders.client')}</Label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setGalleryId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder={dir === 'rtl' ? '— בחר לקוח —' : '— Select client —'} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gallery selector */}
          <div className='space-y-1.5'>
            <Label>{t('orders.gallery')}</Label>
            <Select value={galleryId} onValueChange={setGalleryId} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue placeholder={dir === 'rtl' ? '— בחר גלריה —' : '— Select gallery —'} />
              </SelectTrigger>
              <SelectContent>
                {galleries.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product rows */}
          <div className='space-y-2'>
            <Label>{t('orders.select_product')}</Label>
            {products.map((product, idx) => (
              <div key={idx} className='space-y-1'>
                <div className={`flex items-center gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  {/* Product dropdown */}
                  {productsLoading ? (
                    <Skeleton className='h-9 flex-1' />
                  ) : (
                    <Select
                      value={product.productId}
                      onValueChange={(v) => selectProduct(idx, v)}
                    >
                      <SelectTrigger className='flex-1'>
                        <SelectValue
                          placeholder={dir === 'rtl' ? '— בחר מוצר —' : '— Select product —'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {favoriteProducts.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>★ {t('orders.favorites_group')}</SelectLabel>
                            {favoriteProducts.map((sp: AdminSupplierProduct) => (
                              <SelectItem key={sp.id} value={sp.id}>
                                {sp.name} — {sp.type} — ₪{sp.costPrice}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {otherProducts.length > 0 && (
                          <SelectGroup>
                            {favoriteProducts.length > 0 && <SelectLabel>{t('orders.all_products_group')}</SelectLabel>}
                            {otherProducts.map((sp: AdminSupplierProduct) => (
                              <SelectItem key={sp.id} value={sp.id}>
                                {sp.name} — {sp.type} — ₪{sp.costPrice}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Quantity input */}
                  <Input
                    type='number'
                    min={1}
                    className='w-20'
                    value={product.quantity}
                    onChange={(e) => updateQuantity(idx, parseInt(e.target.value, 10) || 1)}
                  />

                  {/* Remove row */}
                  {products.length > 1 && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='shrink-0 text-destructive hover:text-destructive/80'
                      onClick={() => removeProduct(idx)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>

                {/* Auto-populated price hint */}
                {product.unitCostPrice !== null && (
                  <p className={`text-xs text-muted-foreground ${dir === 'rtl' ? 'text-right' : ''}`}>
                    {dir === 'rtl'
                      ? `עלות: ₪${product.unitCostPrice}${product.unitClientPrice != null ? ` · מחיר ללקוח: ₪${product.unitClientPrice}` : ''}`
                      : `Cost: ₪${product.unitCostPrice}${product.unitClientPrice != null ? ` · Client price: ₪${product.unitClientPrice}` : ''}`}
                  </p>
                )}
              </div>
            ))}

            <Button
              type='button'
              variant='outline'
              size='sm'
              className='gap-1 text-xs'
              onClick={addProduct}
            >
              <Plus size={13} />
              {dir === 'rtl' ? 'הוסף מוצר' : 'Add Product'}
            </Button>
          </div>

          {/* Photographer note */}
          <div className='space-y-1.5'>
            <Label>{t('orders.note.photographer')}</Label>
            <Textarea
              placeholder={dir === 'rtl' ? 'הערה לצלם (אופציונלי)' : 'Photographer note (optional)'}
              value={photographerNote}
              onChange={(e) => setPhotographerNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className={`flex gap-2 pt-2 ${dir === 'rtl' ? 'flex-row-reverse' : 'justify-end'}`}>
          <Button variant='outline' onClick={handleClose}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            className='bg-blush hover:bg-blush/90 text-white'
            onClick={handleSubmit}
            disabled={createOrder.isPending}
          >
            {createOrder.isPending
              ? (dir === 'rtl' ? 'יוצר…' : 'Creating…')
              : (dir === 'rtl' ? 'יצירת הזמנה' : 'Create Order')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
