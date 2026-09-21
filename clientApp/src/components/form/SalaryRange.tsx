import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { MAX_SALARY_DIGITS } from '@/lib/bounds';
import { digitsOnly } from '@/lib/numbers';

interface SalaryRangeProps {
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  describedBy?: string;
}

const isDecreasing = (min: string, max: string): boolean => {
  const from = Number.parseInt(min, 10);
  const to = Number.parseInt(max, 10);

  return !Number.isNaN(from) && !Number.isNaN(to) && to < from;
};

/**
 * One visible heading carries the unit so the two captions can stay short
 * enough to sit side by side on a phone; each input still gets its full name,
 * since a screen reader lands on it without reading the heading.
 */
export function SalaryRange({ min, max, onMinChange, onMaxChange, describedBy }: SalaryRangeProps) {
  const minId = useId();
  const maxId = useId();

  return (
    <div className="flex flex-col gap-2">
      <p aria-hidden="true" className="text-sm font-semibold text-ink">
        Salaire <span className="font-normal text-ink-muted">(€ brut / an)</span>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={minId} className="text-xs text-ink-muted">
            Minimum
          </label>
          <div className="relative">
            <Input
              id={minId}
              aria-label="Salaire minimum (€ brut / an)"
              inputMode="numeric"
              maxLength={MAX_SALARY_DIGITS}
              value={min}
              placeholder="45000"
              onChange={(event) => onMinChange(digitsOnly(event.target.value))}
              className="tabular pr-9"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-muted"
            >
              €
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={maxId} className="text-xs text-ink-muted">
            Maximum
          </label>
          <div className="relative">
            <Input
              id={maxId}
              aria-label="Salaire maximum (€ brut / an)"
              inputMode="numeric"
              maxLength={MAX_SALARY_DIGITS}
              value={max}
              placeholder="55000"
              onChange={(event) => onMaxChange(digitsOnly(event.target.value))}
              aria-invalid={isDecreasing(min, max)}
              aria-describedby={describedBy}
              className="tabular pr-9"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-muted"
            >
              €
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
