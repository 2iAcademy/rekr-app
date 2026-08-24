import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FeedFilterOption {
  value: string;
  label: string;
}

export interface FeedFilterGroup {
  legend: string;
  options: readonly FeedFilterOption[];
  values: readonly string[];
  onToggle: (value: string) => void;
}

interface FilterBarLayoutProps {
  groups: readonly FeedFilterGroup[];
  activeCount: number;
  resultLabel: string;
  onReset: () => void;
}

function Chip({
  option,
  selected,
  onToggle,
}: {
  option: FeedFilterOption;
  selected: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(option.value)}
      className={cn(
        'min-h-11 shrink-0 cursor-pointer rounded-full border px-4 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-role/40',
        selected
          ? 'border-role/40 bg-role/10 font-semibold text-role'
          : 'border-line bg-card text-ink hover:border-role/30',
      )}
    >
      {option.label}
    </button>
  );
}

function ChipGroup({ legend, options, values, onToggle }: FeedFilterGroup) {
  const legendId = useId();

  return (
    <div className="flex flex-col gap-2">
      <p id={legendId} className="text-xs font-medium text-ink-muted">
        {legend}
      </p>
      <div role="group" aria-labelledby={legendId} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.value}
            option={option}
            selected={values.includes(option.value)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

const toggleLabel = (activeCount: number, isExpanded: boolean): string => {
  if (isExpanded) {
    return 'Masquer les filtres';
  }

  if (activeCount === 0) {
    return 'Plus de filtres';
  }

  return activeCount === 1
    ? 'Plus de filtres (1 actif)'
    : `Plus de filtres (${activeCount} actifs)`;
};

/** Shared disclosure and chip layout; each feed owns only its filter data. */
export function FilterBarLayout({
  groups,
  activeCount,
  resultLabel,
  onReset,
}: FilterBarLayoutProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();
  const hasActiveFilter = activeCount > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {!isExpanded && (
          <div
            role="group"
            aria-label="Filtres rapides"
            className="flex min-w-0 flex-1 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {groups.flatMap((group) =>
              group.options.map((option) => (
                <Chip
                  key={`${group.legend}-${option.value}`}
                  option={option}
                  selected={group.values.includes(option.value)}
                  onToggle={group.onToggle}
                />
              )),
            )}
          </div>
        )}

        <button
          type="button"
          aria-label={toggleLabel(activeCount, isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className={cn(
            'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-role/40',
            isExpanded || hasActiveFilter
              ? 'border-role/40 bg-role/10 text-role'
              : 'border-line bg-card text-ink hover:border-role/30',
          )}
        >
          {isExpanded ? (
            <Minus aria-hidden="true" className="size-4" />
          ) : (
            <Plus aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div
          id={panelId}
          className="flex flex-col gap-4 rounded-[1.25rem] border border-line bg-card p-4"
        >
          {groups.map((group) => (
            <ChipGroup key={group.legend} {...group} />
          ))}
          {hasActiveFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-role"
              onClick={onReset}
            >
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      )}

      <p
        role="status"
        aria-live="polite"
        className={cn('text-xs text-ink-faint', !isExpanded && 'sr-only')}
      >
        {resultLabel}
      </p>
    </div>
  );
}
