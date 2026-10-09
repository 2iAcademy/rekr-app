import { useId } from 'react';
import { cn } from '@/lib/utils';

interface WizardProgressProps {
  current: number;
  total: number;
}

export function WizardProgress({ current, total }: WizardProgressProps) {
  const labelId = useId();
  const reached = Math.min(Math.max(current, 0), total);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-labelledby={labelId}
        className="flex w-full gap-1"
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              index < reached ? 'bg-brand' : 'bg-line',
            )}
          />
        ))}
      </div>
      <p id={labelId} className="tabular text-xs font-medium text-ink-muted">
        Étape {current} sur {total}
      </p>
    </div>
  );
}
