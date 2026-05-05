import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/admin/Button';
import { WizardProductRow } from '@/components/admin/WizardProductRow';
import type { ProductRowState } from '@/components/admin/WizardProductRow';
import type { AdminProduct } from '@/hooks/useQueries';

interface WizardStep2Props {
  productRows: ProductRowState[];
  onRowsChange: (rows: ProductRowState[]) => void;
  catalogProducts: AdminProduct[];
  catalogLoading: boolean;
  onFinish: () => void;
  onBack: () => void;
  saving: boolean;
  error: string;
}

export const WizardStep2 = ({
  productRows,
  onRowsChange,
  catalogProducts,
  catalogLoading,
  onFinish,
  onBack,
  saving,
  error,
}: WizardStep2Props) => {
  const { t } = useI18n();
  const [showRowErrors, setShowRowErrors] = useState(false);

  const handleFinishClick = () => {
    if (productRows.some((r) => r.catalogId === '')) {
      setShowRowErrors(true);
      return;
    }
    onFinish();
  };

  const handleRowChange = (index: number, updated: ProductRowState) => {
    const next = [...productRows];
    next[index] = updated;
    onRowsChange(next);
  };

  const handleRowRemove = (index: number) => {
    onRowsChange(productRows.filter((_, i) => i !== index));
  };

  const handleAddRow = () => {
    onRowsChange([
      ...productRows,
      { id: crypto.randomUUID(), catalogId: '', name: '', type: 'album', maxPhotos: 10 },
    ]);
  };

  return (
    <div className='space-y-4'>
      <div>
        <p className='text-sm font-medium text-charcoal'>{t('admin.clients.wizard.step2_heading')}</p>
        <p className='text-xs text-warm-gray mt-0.5'>{t('admin.clients.wizard.step2_subheading')}</p>
      </div>

      {catalogLoading ? (
        <div className='flex justify-center py-4'>
          <span className='w-4 h-4 border-2 border-blush border-t-transparent rounded-full animate-spin' />
        </div>
      ) : catalogProducts.length === 0 ? (
        <p className='text-xs text-warm-gray'>
          {t('admin.clients.wizard.catalog_empty')}{' '}
          <Link to='/admin/settings' className='text-blush underline hover:text-blush/80 transition-colors'>
            {t('admin.clients.wizard.catalog_empty_link')}
          </Link>
        </p>
      ) : (
        <div className='space-y-3'>
          {productRows.length === 0 ? (
            <p className='text-xs text-warm-gray py-3'>{t('admin.clients.wizard.no_products_yet')}</p>
          ) : (
            productRows.map((row, index) => (
              <WizardProductRow
                key={row.id}
                row={row}
                catalogProducts={catalogProducts}
                onChange={(updated) => handleRowChange(index, updated)}
                onRemove={() => handleRowRemove(index)}
                showError={showRowErrors}
                disabled={saving}
              />
            ))
          )}

          <button
            type='button'
            onClick={handleAddRow}
            disabled={saving}
            className='text-xs text-blush hover:text-blush/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
          >
            + {t('admin.clients.wizard.add_product_row')}
          </button>
        </div>
      )}

      {error && (
        <p className='text-xs text-rose-500 bg-rose-50 p-3 rounded-lg'>{error}</p>
      )}

      <div className='flex items-center gap-2 pt-1'>
        <Button type='button' variant='ghost' size='lg' onClick={onBack} disabled={saving}>
          {t('admin.clients.wizard.back')}
        </Button>
        <div className='flex-1' />
        <Button
          type='button'
          variant='primary'
          size='lg'
          onClick={handleFinishClick}
          disabled={saving || productRows.some((r) => r.catalogId === '')}
        >
          {saving ? t('admin.common.saving') : t('admin.clients.wizard.finish')}
        </Button>
      </div>
    </div>
  );
};
