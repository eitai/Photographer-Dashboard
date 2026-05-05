import { Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { AdminProduct } from '@/hooks/useQueries';

export interface ProductRowState {
  id: string;
  catalogId: string;
  name: string;
  type: 'album' | 'print';
  maxPhotos: number;
}

interface WizardProductRowProps {
  row: ProductRowState;
  catalogProducts: AdminProduct[];
  onChange: (updated: ProductRowState) => void;
  onRemove: () => void;
  showError: boolean;
  disabled: boolean;
}

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 disabled:opacity-40 disabled:cursor-not-allowed';

export const WizardProductRow = ({
  row,
  catalogProducts,
  onChange,
  onRemove,
  showError,
  disabled,
}: WizardProductRowProps) => {
  const { t } = useI18n();

  const handleCatalogChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const item = catalogProducts.find((p) => p.id === e.target.value);
    if (!item) return;
    onChange({ ...row, catalogId: item.id, name: item.name, type: item.type, maxPhotos: item.maxPhotos });
  };

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2'>
        <select
          value={row.catalogId}
          onChange={handleCatalogChange}
          disabled={disabled}
          className={`flex-1 ${INPUT_CLASS}`}
        >
          <option value='' disabled>
            {t('admin.clients.wizard.product_required')}
          </option>
          {catalogProducts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {item.type}
            </option>
          ))}
        </select>

        <button
          type='button'
          onClick={onRemove}
          disabled={disabled}
          className='shrink-0 p-1.5 rounded-lg text-warm-gray hover:text-rose-500 hover:bg-rose-50 border border-beige hover:border-rose-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
        >
          <Trash2 size={14} />
        </button>
      </div>

      {row.catalogId !== '' && (
        <div className='flex items-center gap-2'>
          <span className='text-xs text-warm-gray'>מקסימום תמונות:</span>
          <input
            type='number'
            min={1}
            max={500}
            value={row.maxPhotos}
            disabled={disabled}
            onChange={(e) => onChange({ ...row, maxPhotos: Number(e.target.value) })}
            className={`w-20 ${INPUT_CLASS}`}
          />
        </div>
      )}

      {showError && row.catalogId === '' && (
        <p className='text-xs text-rose-500 mt-1'>{t('admin.clients.wizard.product_required')}</p>
      )}
    </div>
  );
};
