import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Package, ShoppingBag } from 'lucide-react';
import { FadeIn } from '@/components/FadeIn';
import { fetchProductOrderByOrderToken, type ProductOrder } from '@/services/productOrderService';
import { OrderPanel } from '@/pages/ClientProductsPage';

export const ClientProductOrderPage = () => {
  const { orderToken } = useParams<{ orderToken: string }>();
  const [order, setOrder] = useState<ProductOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderToken) return;
    (async () => {
      try {
        const data = await fetchProductOrderByOrderToken(orderToken);
        setOrder(data);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(status === 403 ? 'inactive' : 'notfound');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderToken]);

  const handleSubmitted = () => {
    if (order) setOrder({ ...order, status: 'submitted' });
  };

  if (loading) {
    return (
      <main className='min-h-screen flex items-center justify-center' style={{ backgroundColor: '#FAF8F4' }}>
        <div className='w-8 h-8 border-2 border-t-transparent rounded-full animate-spin' style={{ borderColor: '#E7B8B5', borderTopColor: 'transparent' }} />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className='min-h-screen flex items-center justify-center px-6' style={{ backgroundColor: '#FAF8F4' }}>
        <FadeIn>
          <div className='text-center'>
            <Package size={40} className='mx-auto mb-4 text-beige' />
            <p className='text-2xl text-charcoal mb-2'>
              {error === 'inactive' ? 'Link not active' : 'Order not found'}
            </p>
            <p className='text-sm text-warm-gray'>
              {error === 'inactive'
                ? 'This link has been deactivated by your photographer.'
                : 'This link may have expired or is invalid. Please contact your photographer.'}
            </p>
          </div>
        </FadeIn>
      </main>
    );
  }

  return (
    <main className='min-h-screen' style={{ backgroundColor: '#FAF8F4' }}>
      <header className='border-b border-beige bg-white/70 backdrop-blur-sm sticky top-0 z-20'>
        <div className='max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3'>
          <div className='w-8 h-8 rounded-full flex items-center justify-center shrink-0' style={{ backgroundColor: '#E7B8B5' }}>
            <ShoppingBag size={15} className='text-white' />
          </div>
          <h1 className='text-lg text-charcoal leading-tight'>{order.name}</h1>
        </div>
      </header>

      <div className='max-w-5xl mx-auto px-4 sm:px-6 py-8'>
        <FadeIn>
          <OrderPanel order={order} onSubmitted={handleSubmitted} />
        </FadeIn>
      </div>

      <footer className='text-center py-8 mt-4'>
        <p className='text-xs text-warm-gray/60'>LIGHT STUDIO</p>
      </footer>
    </main>
  );
};
