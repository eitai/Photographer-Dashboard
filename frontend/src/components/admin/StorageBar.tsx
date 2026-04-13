import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface StorageBarProps {
  usedGB: number;
  quotaGB: number;
  percentUsed: number;
  compact?: boolean;
}

function getFillClass(percentUsed: number): string {
  if (percentUsed >= 90) return 'bg-red-400';
  if (percentUsed >= 75) return 'bg-amber-400';
  return 'bg-[#E7B8B5]';
}

export function StorageBar({ usedGB, quotaGB, percentUsed, compact = false }: StorageBarProps) {
  const { t } = useI18n();

  const clampedPercent = Math.min(percentUsed, 100);
  const fillClass = getFillClass(percentUsed);
  const trackHeight = compact ? 'h-1' : 'h-2';

  if (compact) {
    return (
      <div className='space-y-1'>
        {/* Bar track — always LTR so fill grows left-to-right */}
        <div dir='ltr' className={cn('w-full rounded-full bg-beige overflow-hidden', trackHeight)}>
          <div
            className={cn('h-full rounded-full transition-all duration-300', fillClass)}
            style={{ width: `${clampedPercent}%` }}
            role='progressbar'
            aria-valuenow={clampedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('storage.used')}
          />
        </div>
        {/* Label */}
        <p className='text-[10px] text-warm-gray'>
          {usedGB.toFixed(1)} / {quotaGB.toFixed(1)} GB
        </p>
        {percentUsed >= 100 && (
          <p className='text-[10px] text-red-500 font-medium'>{t('storage.quotaExceeded')}</p>
        )}
        {percentUsed >= 90 && percentUsed < 100 && (
          <p className='text-[10px] text-amber-600'>{t('storage.nearLimit')}</p>
        )}
      </div>
    );
  }

  return (
    <div className='space-y-1.5'>
      {/* Label row */}
      <div className='flex items-center justify-between text-xs text-warm-gray'>
        <span>
          {t('storage.used')}: {usedGB.toFixed(2)} {t('storage.of')} {quotaGB.toFixed(2)} GB
        </span>
        <span
          className={cn(
            'font-medium',
            percentUsed >= 90 ? 'text-red-500' : percentUsed >= 75 ? 'text-amber-600' : 'text-charcoal',
          )}
        >
          {clampedPercent.toFixed(1)}%
        </span>
      </div>

      {/* Bar track — always LTR so fill grows left-to-right */}
      <div dir='ltr' className={cn('w-full rounded-full bg-beige overflow-hidden', trackHeight)}>
        <div
          className={cn('h-full rounded-full transition-all duration-300', fillClass)}
          style={{ width: `${clampedPercent}%` }}
          role='progressbar'
          aria-valuenow={clampedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('storage.used')}
        />
      </div>

      {percentUsed >= 100 && (
        <p className='text-xs text-red-500 font-medium'>{t('storage.quotaExceeded')}</p>
      )}
      {percentUsed >= 90 && percentUsed < 100 && (
        <p className='text-xs text-amber-600'>{t('storage.nearLimit')}</p>
      )}
    </div>
  );
}
