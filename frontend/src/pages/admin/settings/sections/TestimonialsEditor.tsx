import { useState } from 'react';
import {
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
  type TestimonialItem,
} from '../settingsComponents';
import { SESSION_TYPE_OPTIONS, fieldClass, newId } from '../settingsConstants';

interface TestimonialsEditorProps {
  testimonials: TestimonialItem[];
  setTestimonials: (items: TestimonialItem[]) => void;
}

export const TestimonialsEditor = ({ testimonials, setTestimonials }: TestimonialsEditorProps) => {
  const { t } = useI18n();

  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<Omit<TestimonialItem, 'id'>>({
    text: '', clientName: '', sessionType: '', rating: null,
  });

  const resetTestimonialForm = () => {
    setTestimonialForm({ text: '', clientName: '', sessionType: '', rating: null });
    setEditingTestimonialId(null);
    setShowTestimonialForm(false);
  };

  const handleTestimonialSubmit = () => {
    if (!testimonialForm.text.trim() || !testimonialForm.clientName.trim()) return;
    if (editingTestimonialId) {
      setTestimonials(testimonials.map((item) => item.id === editingTestimonialId ? { ...testimonialForm, id: editingTestimonialId } : item));
    } else {
      if (testimonials.length >= 12) { toast.error(t('admin.settings.max_testimonials')); return; }
      setTestimonials([...testimonials, { ...testimonialForm, id: newId() }]);
    }
    resetTestimonialForm();
  };

  const handleTestimonialEdit = (item: TestimonialItem) => {
    setTestimonialForm({ text: item.text, clientName: item.clientName, sessionType: item.sessionType, rating: item.rating });
    setEditingTestimonialId(item.id);
    setShowTestimonialForm(true);
  };

  const handleTestimonialDelete = (id: string) => setTestimonials(testimonials.filter((item) => item.id !== id));

  const moveTestimonial = (index: number, dir: -1 | 1) => {
    const next = [...testimonials];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setTestimonials(next);
  };

  return (
    <>
      <ul className='space-y-2'>
        {testimonials.map((item, i) => (
          <li key={item.id} className='flex items-start gap-2 border border-beige rounded-lg px-3 py-2'>
            <div className='flex-1 min-w-0'>
              <p className='text-sm text-charcoal line-clamp-2'>{item.text}</p>
              <p className='text-xs text-warm-gray mt-0.5'>{item.clientName}{item.rating ? ` · ${'★'.repeat(item.rating)}` : ''}</p>
            </div>
            <div className='flex items-center gap-1 shrink-0'>
              <button type='button' onClick={() => moveTestimonial(i, -1)} disabled={i === 0} className='p-1 text-warm-gray hover:text-charcoal disabled:opacity-30'>
                <ChevronUp size={14} />
              </button>
              <button type='button' onClick={() => moveTestimonial(i, 1)} disabled={i === testimonials.length - 1} className='p-1 text-warm-gray hover:text-charcoal disabled:opacity-30'>
                <ChevronDown size={14} />
              </button>
              <button type='button' onClick={() => handleTestimonialEdit(item)} className='p-1 text-warm-gray hover:text-blush'>
                <Pencil size={14} />
              </button>
              <button type='button' onClick={() => handleTestimonialDelete(item.id)} className='p-1 text-warm-gray hover:text-red-500'>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showTestimonialForm ? (
        <div className='border border-beige rounded-xl p-4 bg-ivory space-y-3'>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.client_name')}</label>
            <input className={fieldClass} value={testimonialForm.clientName} onChange={(e) => setTestimonialForm((f) => ({ ...f, clientName: e.target.value }))} />
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.description')}</label>
            <textarea className={`${fieldClass} resize-none`} rows={3} value={testimonialForm.text} onChange={(e) => setTestimonialForm((f) => ({ ...f, text: e.target.value }))} />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.session_type')}</label>
              <select className={fieldClass} value={testimonialForm.sessionType} onChange={(e) => setTestimonialForm((f) => ({ ...f, sessionType: e.target.value }))}>
                <option value=''>—</option>
                {SESSION_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.rating')}</label>
              <select className={fieldClass} value={testimonialForm.rating ?? ''} onChange={(e) => setTestimonialForm((f) => ({ ...f, rating: e.target.value ? Number(e.target.value) : null }))}>
                <option value=''>—</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
          </div>
          <div className='flex gap-2 pt-1'>
            <button type='button' onClick={handleTestimonialSubmit} className='flex items-center gap-1 px-3 py-1.5 bg-blush text-white text-xs rounded-lg hover:opacity-90'>
              <Check size={13} /> {t('admin.common.save')}
            </button>
            <button type='button' onClick={resetTestimonialForm} className='flex items-center gap-1 px-3 py-1.5 text-xs text-warm-gray hover:text-charcoal'>
              <X size={13} /> {t('admin.common.cancel')}
            </button>
          </div>
        </div>
      ) : testimonials.length < 12 && (
        <button
          type='button'
          onClick={() => { setEditingTestimonialId(null); setShowTestimonialForm(true); }}
          className='flex items-center gap-1 text-xs text-blush hover:text-charcoal transition-colors'
        >
          <Plus size={13} /> {t('admin.settings.sections.add_testimonial')}
        </button>
      )}
    </>
  );
};
