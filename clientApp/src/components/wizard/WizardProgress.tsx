import { useId } from 'react';

interface WizardProgressProps {
  current: number;
  total: number;
}

export function WizardProgress({ current, total }: WizardProgressProps) {
  const labelId = useId();
  const ratio = Math.min(Math.max(current / total, 0), 1);

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-xs font-medium text-ink-muted">
        Étape {current} sur {total}
      </p>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-labelledby={labelId}
        className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-role-gradient transition-[width] duration-300"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
