import { useId } from 'react';
import { Check } from 'lucide-react';
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
    <div className="flex flex-col gap-2">
      <p id={legendId} className="text-sm font-semibold text-ink">
        {legend}
      </p>
      <div
        role="group"
        aria-labelledby={legendId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}
      >
        {options.map((option) => {
          const selected = values.includes(option.value);

          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-center text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand/30',
                selected
                  ? 'border-brand bg-brand-tint font-semibold text-brand-strong'
                  : 'border-line bg-card text-ink hover:border-ink-faint/40',
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
              {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
