import { useId } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Draws the option as a card, the icon next to its label. */
  icon?: LucideIcon;
}

interface OptionCardsProps<T extends string> {
  legend: string;
  name: string;
  options: readonly Option<T>[];
  value: T | '';
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  invalid?: boolean;
  describedBy?: string;
}

const GRID_COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' } as const;

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
  // A description or an icon turns the row of pills into cards; deriving it
  // keeps callers from having to pick a layout that the data already implies.
  const stacked = options.some(
    (option) => option.description !== undefined || option.icon !== undefined,
  );

  return (
    <div className="flex flex-col gap-2">
      <p id={legendId} className="text-sm font-semibold text-ink">
        {legend}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={legendId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cn('grid gap-2', GRID_COLUMNS[columns])}
      >
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <label
              key={option.value}
              className={cn(
                'relative flex cursor-pointer rounded-xl border transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand/30',
                stacked
                  ? 'min-h-18 items-center gap-3 py-3.5 pr-8 pl-4'
                  : 'min-h-11 items-center justify-center gap-1.5 px-2.5 py-2.5 text-center text-sm',
                selected
                  ? 'border-brand bg-brand-tint font-semibold text-brand-strong'
                  : 'border-line bg-card text-ink hover:border-ink-faint/40',
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
                  {option.icon && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-full',
                        selected ? 'bg-card text-brand-strong' : 'bg-surface text-ink-soft',
                      )}
                    >
                      <option.icon className="size-5" />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-bold">{option.label}</span>
                    {option.description && (
                      <span
                        className={cn(
                          'text-xs font-normal',
                          selected ? 'text-brand-strong' : 'text-ink-muted',
                        )}
                      >
                        {option.description}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <Check aria-hidden="true" className="absolute top-2.5 right-2.5 size-4" />
                  )}
                </>
              ) : (
                <>
                  {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
                  {option.label}
                </>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
