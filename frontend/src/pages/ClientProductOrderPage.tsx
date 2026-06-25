import { useParams } from 'react-router-dom';
import { Package, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { fetchProductOrderByOrderToken } from '@/services/productOrderService';
import { OrderPanel } from '@/pages/ClientProductsPage';

export const ClientProductOrderPage = () => {
  const { orderToken } = useParams<{ orderToken: string }>();
  const { t } = useI18n();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['productOrder', orderToken],
    queryFn: () => fetchProductOrderByOrderToken(orderToken!),
    enabled: !!orderToken,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: (count, err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 404) return false;
      return count < 2;
    },
  });

  const handleSubmitted = () => {
    // optimistic update handled locally by OrderPanel; query will sync on next poll
  };

  if (isLoading) {
    return (
      <main data-theme="bw" className='min-h-screen flex items-center justify-center bg-background'>
        <div className='w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin' />
      </main>
    );
  }

  if (error || !order) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return (
      <main data-theme="bw" className='min-h-screen flex items-center justify-center px-6 bg-background'>
        <FadeIn>
          <div className='text-center'>
            <Package size={40} className='mx-auto mb-4 text-muted-foreground' />
            <p className='text-2xl font-semibold text-foreground mb-2'>
              {status === 403 ? t('products.no_products_title') : t('products.no_products_title')}
            </p>
            <p className='text-sm text-muted-foreground'>{t('products.no_products_desc')}</p>
          </div>
        </FadeIn>
      </main>
    );
  }

  return (
    <main data-theme="bw" className='min-h-screen bg-background'>
      <header className='border-b border-border bg-background sticky top-0 z-20'>
        <div className='max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3'>
          <div className='w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0'>
            <ShoppingBag size={15} className='text-background' />
          </div>
          <h1 className='text-lg font-semibold text-foreground leading-tight'>{order.name}</h1>
        </div>
      </header>

      <div className='max-w-5xl mx-auto px-4 sm:px-6 py-8'>
        <FadeIn>
          <OrderPanel order={order} onSubmitted={handleSubmitted} stickyTop='top-16' />
        </FadeIn>
      </div>

      <footer className='text-center py-8 mt-4'>
        <p className='text-xs text-muted-foreground tracking-widest uppercase'>Light Studio</p>
      </footer>
    </main>
  );
};
