import { useState } from 'react';
import {
  Camera,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import {
  ServiceIconPicker,
  type ServiceItem,
} from '../settingsComponents';
import { SERVICE_ICONS, fieldClass, newId } from '../settingsConstants';

interface ServicesEditorProps {
  services: ServiceItem[];
  setServices: (items: ServiceItem[]) => void;
}

export const ServicesEditor = ({ services, setServices }: ServicesEditorProps) => {
  const { t } = useI18n();

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<Omit<ServiceItem, 'id'>>({
    icon: 'camera', title: '', description: '', startingPrice: '', sessionTypeValue: '',
  });

  const resetServiceForm = () => {
    setServiceForm({ icon: 'camera', title: '', description: '', startingPrice: '', sessionTypeValue: '' });
    setEditingServiceId(null);
    setShowServiceForm(false);
  };

  const handleServiceSubmit = () => {
    if (!serviceForm.title.trim()) return;
    if (editingServiceId) {
      setServices(services.map((s) => s.id === editingServiceId ? { ...serviceForm, id: editingServiceId } : s));
    } else {
      if (services.length >= 8) { toast.error(t('admin.settings.max_services')); return; }
      setServices([...services, { ...serviceForm, id: newId() }]);
    }
    resetServiceForm();
  };

  const handleServiceEdit = (item: ServiceItem) => {
    setServiceForm({ icon: item.icon, title: item.title, description: item.description, startingPrice: item.startingPrice, sessionTypeValue: item.sessionTypeValue });
    setEditingServiceId(item.id);
    setShowServiceForm(true);
  };

  const handleServiceDelete = (id: string) => setServices(services.filter((s) => s.id !== id));

  const moveService = (index: number, dir: -1 | 1) => {
    const next = [...services];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setServices(next);
  };

  return (
    <>
      <ul className='space-y-2'>
        {services.map((item, i) => {
          const IconComp = SERVICE_ICONS.find((ic) => ic.name === item.icon)?.Icon ?? Camera;
          return (
            <li key={item.id} className='flex items-start gap-2 border border-beige rounded-lg px-3 py-2'>
              <IconComp size={16} className='mt-0.5 text-blush shrink-0' />
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium text-charcoal truncate'>{item.title}</p>
                {item.startingPrice && <p className='text-xs text-warm-gray'>{item.startingPrice}</p>}
              </div>
              <div className='flex items-center gap-1 shrink-0'>
                <button type='button' onClick={() => moveService(i, -1)} disabled={i === 0} className='p-1 text-warm-gray hover:text-charcoal disabled:opacity-30'>
                  <ChevronUp size={14} />
                </button>
                <button type='button' onClick={() => moveService(i, 1)} disabled={i === services.length - 1} className='p-1 text-warm-gray hover:text-charcoal disabled:opacity-30'>
                  <ChevronDown size={14} />
                </button>
                <button type='button' onClick={() => handleServiceEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                  <Pencil size={14} />
                </button>
                <button type='button' onClick={() => handleServiceDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {showServiceForm ? (
        <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
          <ServiceIconPicker value={serviceForm.icon} onChange={(v) => setServiceForm((f) => ({ ...f, icon: v }))} />
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.title')}</label>
            <input className={fieldClass} value={serviceForm.title} onChange={(e) => setServiceForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.description')}</label>
            <textarea className={`${fieldClass} resize-none`} rows={3} value={serviceForm.description} onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.starting_price')}</label>
            <input className={fieldClass} value={serviceForm.startingPrice} onChange={(e) => setServiceForm((f) => ({ ...f, startingPrice: e.target.value }))} />
          </div>
          <div className='flex gap-2 pt-1'>
            <button type='button' onClick={handleServiceSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
              <Check size={13} /> {t('admin.common.save')}
            </button>
            <button type='button' onClick={resetServiceForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
              <X size={13} /> {t('admin.common.cancel')}
            </button>
          </div>
        </div>
      ) : services.length < 8 && (
        <button
          type='button'
          onClick={() => { setEditingServiceId(null); setShowServiceForm(true); }}
          className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
        >
          <Plus size={13} /> {t('admin.settings.sections.add_service')}
        </button>
      )}
    </>
  );
};
