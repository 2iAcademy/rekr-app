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

export function SalaryRange({ min, max, onMinChange, onMaxChange, describedBy }: SalaryRangeProps) {
  const minId = useId();
  const maxId = useId();

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={minId} className="text-xs text-ink-muted">
          Salaire minimum (€ brut / an)
        </label>
        <Input
          id={minId}
          inputMode="numeric"
          maxLength={MAX_SALARY_DIGITS}
          value={min}
          placeholder="45000"
          onChange={(event) => onMinChange(digitsOnly(event.target.value))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={maxId} className="text-xs text-ink-muted">
          Salaire maximum (€ brut / an)
        </label>
        <Input
          id={maxId}
          inputMode="numeric"
          maxLength={MAX_SALARY_DIGITS}
          value={max}
          placeholder="55000"
          onChange={(event) => onMaxChange(digitsOnly(event.target.value))}
          aria-invalid={isDecreasing(min, max)}
          aria-describedby={describedBy}
        />
      </div>
    </div>
  );
}
