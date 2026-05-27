import { useI18n } from '@/lib/i18n';

// Ordered steps — null means unlimited (∞)
const STEPS: (number | null)[] = [1, 5, 10, 20, 50, 100, 200, 500, 1000, null];
const MAX_IDX = STEPS.length - 1;

function label(step: number | null): string {
  if (step === null) return '∞';
  if (step >= 1000) return `${step / 1000}TB`;
  return `${step}GB`;
}

interface QuotaSliderProps {
  value: number | null;
  onChange: (v: number | null) => void;
}

export function QuotaSlider({ value, onChange }: QuotaSliderProps) {
  const { t } = useI18n();

  const idx =
    value === null
      ? MAX_IDX
      : (() => {
          let best = 0;
          let bestDiff = Infinity;
          STEPS.forEach((s, i) => {
            if (s === null) return;
            const diff = Math.abs(s - value);
            if (diff < bestDiff) { bestDiff = diff; best = i; }
          });
          return best;
        })();

  const isUnlimited = idx === MAX_IDX;
  const fillPct = (idx / MAX_IDX) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(STEPS[Number(e.target.value)]);
  };

  return (
    <div className='space-y-3'>
      {/* Label + value badge — respects page direction */}
      <div className='flex items-center justify-between'>
        <span className='text-xs text-warm-gray'>{t('admin.users.storage_quota_label')}</span>
        <span
          className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${
            isUnlimited
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : 'bg-blush/10 text-charcoal border-beige'
          }`}
        >
          {isUnlimited ? `∞ ${t('admin.users.unlimited_label')}` : label(STEPS[idx])}
        </span>
      </div>

      {/*
        Force dir="ltr" on the entire slider so that:
        - range input thumb moves left → right regardless of page direction
        - fill grows from the left
        - thumb position (left: X%) is always correct
      */}
      <div dir='ltr' className='space-y-2'>
        {/* Track + thumb */}
        <div className='relative h-5 flex items-center'>
          {/* Track background */}
          <div className='absolute inset-x-0 h-2 rounded-full bg-beige overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all duration-150 ${
                isUnlimited ? 'bg-amber-400' : 'bg-[#E7B8B5]'
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>

          {/* Native range — invisible but interactive */}
          <input
            type='range'
            min={0}
            max={MAX_IDX}
            step={1}
            value={idx}
            onChange={handleChange}
            className='absolute inset-x-0 w-full opacity-0 cursor-pointer h-5 z-10'
            aria-label={t('admin.users.storage_quota_label')}
          />

          {/* Custom thumb */}
          <div
            className={`absolute w-4 h-4 rounded-full border-2 shadow-sm transition-all duration-150 pointer-events-none z-0 ${
              isUnlimited
                ? 'bg-amber-400 border-amber-500'
                : 'bg-card border-[#E7B8B5]'
            }`}
            style={{ left: `calc(${fillPct}% - 8px)` }}
          />
        </div>

        {/* Tick labels — always LTR order (1GB … ∞) */}
        <div className='flex justify-between'>
          {STEPS.map((s, i) => (
            <button
              key={i}
              type='button'
              onClick={() => onChange(s)}
              className={`text-[10px] transition-colors hover:text-charcoal ${
                i === idx
                  ? isUnlimited
                    ? 'text-amber-500 font-semibold'
                    : 'text-charcoal font-semibold'
                  : 'text-warm-gray'
              }`}
            >
              {label(s)}
            </button>
          ))}
        </div>
      </div>

      {isUnlimited && (
        <p className='text-[10px] text-amber-600'>{t('admin.users.storage_unlimited_hint')}</p>
      )}
    </div>
  );
}
