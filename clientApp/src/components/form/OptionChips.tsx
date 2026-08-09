import { useId } from 'react';
import { cn } from '@/lib/utils';
import type { Option } from './OptionCards';

interface OptionChipsProps<T extends string> {
  legend: string;
  name: string;
  options: readonly Option<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  columns?: 2 | 3;
  invalid?: boolean;
  describedBy?: string;
}

export function OptionChips<T extends string>({
  legend,
  name,
  options,
  values,
  onChange,
  columns = 3,
  invalid,
  describedBy,
}: OptionChipsProps<T>) {
  const legendId = useId();

  // Rebuilt from `options` rather than appended to `values`, so the selection
  // always reads in the order the candidate sees on screen.
  const toggle = (option: T): void => {
    const next = values.includes(option)
      ? values.filter((kept) => kept !== option)
      : [...values, option];

    onChange(options.map(({ value }) => value).filter((value) => next.includes(value)));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p id={legendId} className="text-xs text-ink-muted">
        {legend}
      </p>
      <div
        role="group"
        aria-labelledby={legendId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cn('grid gap-2.5', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}
      >
        {options.map((option) => {
          const selected = values.includes(option.value);

          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center rounded-[0.9375rem] px-3 py-2.5 text-center text-sm transition-all has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-role/40',
                selected
                  ? 'bg-role-gradient font-semibold text-white shadow-role'
                  : 'border border-line bg-card text-ink hover:border-role/30',
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => toggle(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
