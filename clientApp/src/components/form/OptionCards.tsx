import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface OptionCardsProps<T extends string> {
  legend: string;
  name: string;
  options: readonly Option<T>[];
  value: T | '';
  onChange: (value: T) => void;
  columns?: 2 | 3;
  invalid?: boolean;
  describedBy?: string;
}

export function OptionCards<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  columns = 3,
  invalid,
  describedBy,
}: OptionCardsProps<T>) {
  const legendId = useId();
  // Descriptions turn the row of pills into stacked cards; deriving it keeps
  // callers from having to pick a layout that the data already implies.
  const stacked = options.some((option) => option.description !== undefined);

  return (
    <div className="flex flex-col gap-2.5">
      <p id={legendId} className="text-xs text-ink-muted">
        {legend}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={legendId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cn('grid gap-2.5', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}
      >
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <label
              key={option.value}
              className={cn(
                'cursor-pointer rounded-[0.9375rem] transition-all has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-role/40',
                stacked
                  ? 'flex min-h-18 flex-col justify-center gap-1 px-4 py-3.5'
                  : 'flex min-h-11 items-center justify-center px-3 py-2.5 text-center text-sm',
                selected
                  ? 'bg-role-gradient font-semibold text-white shadow-role'
                  : 'border border-line bg-card text-ink hover:border-role/30',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {stacked ? (
                <>
                  <span className="font-heading text-sm font-semibold">{option.label}</span>
                  {option.description && (
                    <span className={cn('text-xs', selected ? 'text-white/80' : 'text-ink-muted')}>
                      {option.description}
                    </span>
                  )}
                </>
              ) : (
                option.label
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
