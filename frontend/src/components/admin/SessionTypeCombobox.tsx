import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { ChevronDown } from 'lucide-react';

export const SESSION_TYPE_KEYS = [
  'family', 'maternity', 'newborn', 'wedding', 'bar_mitzvah', 'bat_mitzvah',
  'brit_milah', 'engagement', 'birthday', 'branding', 'landscape', 'corporate',
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SessionTypeCombobox = ({ value, onChange, className = '' }: Props) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const getLabel = (val: string) => {
    if (!val) return '';
    const translated = t(`admin.session.${val}`);
    return translated.startsWith('admin.session.') ? val : translated;
  };

  const [inputValue, setInputValue] = useState(() => getLabel(value));

  useEffect(() => {
    if (!open) setInputValue(getLabel(value));
  }, [value, open]);

  const options = SESSION_TYPE_KEYS.map((st) => ({ key: st, label: t(`admin.session.${st}`) }));

  const filtered = inputValue.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(inputValue.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    setOpen(true);
    const exact = options.find((o) => o.label.toLowerCase() === raw.toLowerCase());
    onChange(exact ? exact.key : raw);
  };

  const handleSelect = (opt: { key: string; label: string }) => {
    onChange(opt.key);
    setInputValue(opt.label);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) handleSelect(filtered[0]);
      else setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className='relative'>
        <input
          type='text'
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete='off'
          className='w-full px-3 py-2 pe-8 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
        />
        <ChevronDown
          size={14}
          className={`absolute end-2.5 top-1/2 -translate-y-1/2 text-warm-gray pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <ul className='absolute z-50 mt-1 w-full bg-card border border-beige rounded-lg shadow-lg max-h-48 overflow-y-auto'>
          {filtered.map((opt) => (
            <li
              key={opt.key}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-ivory transition-colors ${opt.key === value ? 'text-blush font-medium' : 'text-charcoal'}`}
            >
              {opt.label}
            </li>
          ))}
          {filtered.length === 0 && inputValue.trim() && (
            <li
              onMouseDown={(e) => { e.preventDefault(); onChange(inputValue.trim()); setOpen(false); }}
              className='px-3 py-2 text-sm cursor-pointer text-warm-gray hover:bg-ivory hover:text-charcoal transition-colors'
            >
              "{inputValue.trim()}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
