import { useNavigate, Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { useAdminSupplierProducts } from '@/hooks/useQueries';
import { useAuthStore } from '@/store/authStore';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { getImageUrl, type AdminSupplierProduct } from '@/lib/api';
import { Star, Package, Clock, AlertTriangle } from 'lucide-react';

const ProductCard = ({ product, onClick }: { product: AdminSupplierProduct; onClick: () => void }) => {
  const { t } = useI18n();
  const imageUrl = product.imagePreviewPath ? getImageUrl(product.imagePreviewPath) : null;

  return (
    <button
      type='button'
      onClick={onClick}
      className='group text-start bg-card rounded-2xl border border-beige overflow-hidden hover:border-charcoal/30 hover:shadow-md transition-all'
    >
      <div className='aspect-[4/3] bg-ivory flex items-center justify-center overflow-hidden relative'>
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} className='w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300' />
        ) : (
          <Package size={32} className='text-beige' />
        )}
        {product.isFavorite && (
          <span className='absolute top-2 end-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm'>
            <Star size={14} className='text-blush' fill='currentColor' />
          </span>
        )}
      </div>
      <div className='p-3'>
        <p className='font-medium text-charcoal text-sm truncate'>{product.name}</p>
        <p className='text-xs text-warm-gray capitalize'>{product.type}</p>
        <div className='flex items-center justify-between mt-2'>
          <span className='text-sm font-semibold text-charcoal'>₪{product.costPrice}</span>
          {product.productionDays != null && (
            <span className='flex items-center gap-1 text-[11px] text-warm-gray'>
              <Clock size={11} />
              {product.productionDays}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export const AdminStore = () => {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const admin = useAuthStore((s) => s.admin);
  const { data: products = [], isLoading } = useAdminSupplierProducts();

  // Ordering gate (mirrors the backend reason codes)
  const gateReason =
    admin?.canOrderSupplier === false ? 'no_permission'
    : admin?.billingBlocked ? 'blocked'
    : admin?.hasCardOnFile === false ? 'no_card'
    : null;

  const favorites = products.filter((p) => p.isFavorite);
  const others = products.filter((p) => !p.isFavorite);

  const grid = (list: AdminSupplierProduct[]) => (
    <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
      {list.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => { if (!gateReason) navigate(`/admin/store/order/${product.id}`); }}
        />
      ))}
    </div>
  );

  return (
    <AdminLayout>
      <div className='p-6 space-y-6' dir={dir}>
        <div>
          <h1 className='font-serif text-2xl text-charcoal'>{t('store.direct.title')}</h1>
          <p className='text-sm text-warm-gray mt-1'>{t('store.direct.subtitle')}</p>
        </div>

        {gateReason && (
          <div className='flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3'>
            <span className='flex items-center gap-2 text-sm text-amber-800'>
              <AlertTriangle size={16} className='shrink-0' />
              {t(`admin.billing.gate.${gateReason}`)}
            </span>
            {gateReason !== 'no_permission' && (
              <Link to='/admin/billing-store' className='text-sm text-charcoal underline whitespace-nowrap'>
                {t('admin.billing.go_to_billing')}
              </Link>
            )}
          </div>
        )}

        {isLoading ? (
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className='aspect-[4/3] rounded-2xl' />)}
          </div>
        ) : products.length === 0 ? (
          <div className='text-center py-20'>
            <Package size={32} className='mx-auto mb-3 text-beige' />
            <p className='text-sm text-warm-gray'>{t('admin.favorites.empty')}</p>
          </div>
        ) : (
          <div className='space-y-8'>
            {favorites.length > 0 && (
              <section>
                <h2 className='text-xs font-semibold tracking-widest uppercase text-warm-gray mb-3 flex items-center gap-1.5'>
                  <Star size={12} className='text-blush' fill='currentColor' />
                  {t('orders.favorites_group')}
                </h2>
                {grid(favorites)}
              </section>
            )}
            {others.length > 0 && (
              <section>
                {favorites.length > 0 && (
                  <h2 className='text-xs font-semibold tracking-widest uppercase text-warm-gray mb-3'>
                    {t('orders.all_products_group')}
                  </h2>
                )}
                {grid(others)}
              </section>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
