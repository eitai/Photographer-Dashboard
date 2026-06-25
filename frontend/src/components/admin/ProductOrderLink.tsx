import { useState } from 'react';
import { Link as LinkIcon, Check, Copy } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { toggleProductOrderLink, type ProductOrder } from '@/services/productOrderService';

interface Props {
  order: ProductOrder;
  refetch: () => void;
}

export const ProductOrderLink = ({ order, refetch }: Props) => {
  const { t } = useI18n();
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await toggleProductOrderLink(order._id, !order.linkEnabled);
      refetch();
    } catch { /* ignore */ }
    finally { setToggling(false); }
  };

  const handleCopy = () => {
    const url = `${window.location.origin}/products/order/${order.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className='px-4 py-3'>
      <p className='text-[11px] font-medium text-warm-gray uppercase tracking-wide mb-1.5'>
        {t('admin.products.link_label')}
      </p>
      <div className='flex items-center gap-2 flex-wrap'>
        <button
          onClick={handleToggle}
          disabled={toggling}
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
            onClick={handleCopy}
            className='flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-ivory text-warm-gray border-beige hover:border-blush hover:text-charcoal transition-colors cursor-pointer'
          >
            {copied ? <Check size={10} className='text-green-500' /> : <Copy size={10} />}
            {copied ? t('admin.client.copied') : t('admin.products.copy_link')}
          </button>
        )}
      </div>
    </div>
  );
};
