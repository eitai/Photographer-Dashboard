import { useState } from 'react';
import {
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import {
  type PackageItem,
} from '../settingsComponents';
import { fieldClass, newId } from '../settingsConstants';

interface PackagesEditorProps {
  packages: PackageItem[];
  setPackages: (items: PackageItem[]) => void;
  packagesDisclaimer: string;
  setPackagesDisclaimer: (v: string) => void;
}

export const PackagesEditor = ({ packages, setPackages, packagesDisclaimer, setPackagesDisclaimer }: PackagesEditorProps) => {
  const { t } = useI18n();

  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState<Omit<PackageItem, 'id' | 'inclusions'> & { inclusionsRaw: string }>({
    name: '', price: '', inclusionsRaw: '', isHighlighted: false, ctaLabel: '',
  });

  const resetPackageForm = () => {
    setPackageForm({ name: '', price: '', inclusionsRaw: '', isHighlighted: false, ctaLabel: '' });
    setEditingPackageId(null);
    setShowPackageForm(false);
  };

  const handlePackageSubmit = () => {
    if (!packageForm.name.trim() || !packageForm.price.trim()) return;
    const inclusions = packageForm.inclusionsRaw.split('\n').map((l) => l.trim()).filter(Boolean);
    const item: PackageItem = {
      id: editingPackageId ?? newId(),
      name: packageForm.name,
      price: packageForm.price,
      inclusions,
      isHighlighted: packageForm.isHighlighted,
      ctaLabel: packageForm.ctaLabel,
    };
    if (editingPackageId) {
      setPackages(packages.map((p) => p.id === editingPackageId ? item : p));
    } else {
      if (packages.length >= 4) { toast.error(t('admin.settings.max_packages')); return; }
      setPackages([...packages, item]);
    }
    resetPackageForm();
  };

  const handlePackageEdit = (item: PackageItem) => {
    setPackageForm({ name: item.name, price: item.price, inclusionsRaw: item.inclusions.join('\n'), isHighlighted: item.isHighlighted, ctaLabel: item.ctaLabel });
    setEditingPackageId(item.id);
    setShowPackageForm(true);
  };

  const handlePackageDelete = (id: string) => setPackages(packages.filter((p) => p.id !== id));

  return (
    <>
      <ul className='space-y-2'>
        {packages.map((item) => (
          <li key={item.id} className='flex items-start gap-2 border border-beige rounded-lg px-3 py-2'>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium text-charcoal flex items-center gap-2'>
                {item.name}
                {item.isHighlighted && <span className='text-[10px] bg-blush/20 text-blush px-1.5 py-0.5 rounded-full'>Popular</span>}
              </p>
              <p className='text-xs text-warm-gray'>{item.price}</p>
            </div>
            <div className='flex items-center gap-1 shrink-0'>
              <button type='button' onClick={() => handlePackageEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                <Pencil size={14} />
              </button>
              <button type='button' onClick={() => handlePackageDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showPackageForm ? (
        <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.package_name')}</label>
              <input className={fieldClass} value={packageForm.name} onChange={(e) => setPackageForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.price')}</label>
              <input className={fieldClass} value={packageForm.price} onChange={(e) => setPackageForm((f) => ({ ...f, price: e.target.value }))} placeholder='Starting from ₪1,500' />
            </div>
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.inclusions')}</label>
            <textarea className={`${fieldClass} resize-none`} rows={4} value={packageForm.inclusionsRaw} onChange={(e) => setPackageForm((f) => ({ ...f, inclusionsRaw: e.target.value }))} />
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.cta_label')}</label>
            <input className={fieldClass} value={packageForm.ctaLabel} onChange={(e) => setPackageForm((f) => ({ ...f, ctaLabel: e.target.value }))} />
          </div>
          <label className='flex items-center gap-2 text-xs text-charcoal cursor-pointer'>
            <input
              type='checkbox'
              checked={packageForm.isHighlighted}
              onChange={(e) => setPackageForm((f) => ({ ...f, isHighlighted: e.target.checked }))}
              className='accent-blush'
            />
            {t('admin.settings.sections.highlight')}
          </label>
          <div className='flex gap-2 pt-1'>
            <button type='button' onClick={handlePackageSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
              <Check size={13} /> {t('admin.common.save')}
            </button>
            <button type='button' onClick={resetPackageForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
              <X size={13} /> {t('admin.common.cancel')}
            </button>
          </div>
        </div>
      ) : packages.length < 4 && (
        <button
          type='button'
          onClick={() => { setEditingPackageId(null); setShowPackageForm(true); }}
          className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
        >
          <Plus size={13} /> {t('admin.settings.sections.add_package')}
        </button>
      )}

      <div>
        <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.disclaimer')}</label>
        <input
          className={fieldClass}
          value={packagesDisclaimer}
          onChange={(e) => setPackagesDisclaimer(e.target.value)}
          placeholder='* Prices may vary depending on location'
        />
      </div>
    </>
  );
};
