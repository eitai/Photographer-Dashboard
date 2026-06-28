import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/admin/Button';
import { useI18n } from '@/lib/i18n';
import { THEMES, THEME_META, SERVICE_ICONS } from './settingsConstants';

export type HeroOverlayOpacity = 'light' | 'medium' | 'dark';

export interface StatItem {
  id: string;
  value: number;
  suffix: string;
  label: string;
}

export interface PromiseItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface ServiceItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  startingPrice: string;
  sessionTypeValue: string;
}

export interface TestimonialItem {
  id: string;
  text: string;
  clientName: string;
  sessionType: string;
  rating: number | null;
}

export interface PackageItem {
  id: string;
  name: string;
  price: string;
  inclusions: string[];
  isHighlighted: boolean;
  ctaLabel: string;
}

interface ThemePickerProps {
  value: string;
  onChange: (key: string) => void;
  label: string;
  getLabel: (key: string) => string;
}

export const ThemePicker = ({ value, onChange, label, getLabel }: ThemePickerProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = THEME_META[value];

  return (
    <div>
      <label className='block text-xs text-warm-gray mb-2'>{label}</label>
      <div ref={ref} className='relative'>
        <button
          type='button'
          onClick={() => setOpen((o) => !o)}
          className='w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-card border border-beige text-charcoal text-sm hover:border-blush/50 transition-colors'
        >
          <div
            className='w-4 h-4 rounded-full border flex-shrink-0'
            style={{ background: `linear-gradient(135deg, ${current?.bg} 50%, ${current?.primary} 50%)` }}
          />
          <span className='flex-1 text-left'>{getLabel(value)}</span>
          <svg width='12' height='12' viewBox='0 0 12 12' fill='currentColor' className='text-warm-gray'>
            <path d='M2 4l4 4 4-4' stroke='currentColor' strokeWidth='1.5' fill='none' strokeLinecap='round' />
          </svg>
        </button>

        {open && (
          <div className='absolute z-50 mt-1 w-full bg-card border border-beige rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto'>
            {THEMES.map((key) => {
              const m = THEME_META[key];
              const isSelected = value === key;
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-ivory transition-colors ${isSelected ? 'text-charcoal font-medium' : 'text-warm-gray'}`}
                >
                  <div
                    className='w-5 h-5 rounded-full border flex-shrink-0'
                    style={{ background: `linear-gradient(135deg, ${m.bg} 50%, ${m.primary} 50%)` }}
                  />
                  {getLabel(key)}
                  {isSelected && <span className='ms-auto text-blush'>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface SectionCardProps {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  enabledLabel: string;
  children: React.ReactNode;
  onSave: () => void;
  saveLabel: string;
  saving: boolean;
}

export const SectionCard = ({ title, enabled, onToggle, enabledLabel, children, onSave, saveLabel, saving }: SectionCardProps) => (
  <div className='bg-card rounded-xl border border-beige p-6 space-y-4'>
    <div className='flex items-center justify-between gap-4'>
      <h3 className='font-semibold text-charcoal'>{title}</h3>
      <label className='flex items-center gap-2 cursor-pointer select-none'>
        <span className='text-xs text-warm-gray'>{enabledLabel}</span>
        <button
          type='button'
          role='switch'
          aria-checked={enabled}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-blush ${enabled ? 'bg-blush' : 'bg-beige'}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${enabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </label>
    </div>

    {children}

    <div className='pt-2 border-t border-beige'>
      <Button type='button' variant='primary' size='sm' onClick={onSave} disabled={saving}>
        {saving ? '...' : saveLabel}
      </Button>
    </div>
  </div>
);

export const ServiceIconPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const { t } = useI18n();
  return (
    <div>
      <label className='block text-xs text-warm-gray mb-1'>{t('admin.settings.sections.icon')}</label>
      <div className='flex flex-wrap gap-2'>
        {SERVICE_ICONS.map(({ name, Icon }) => (
          <button
            key={name}
            type='button'
            onClick={() => onChange(name)}
            className={`p-2 rounded-lg border transition-colors ${value === name ? 'border-blush bg-blush/10 text-blush' : 'border-beige text-warm-gray hover:border-blush/50'}`}
            title={name}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
};
