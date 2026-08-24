import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ContractType, ExperienceLevel } from '@/domain/enums';
import { CONTRACT_TYPE_OPTIONS, EXPERIENCE_LEVEL_OPTIONS } from '@/domain/options';
import { cn } from '@/lib/utils';
import { activeFilterCount } from '../filters';
import { emptyFeedFilters, type FeedFilters } from '../types';

interface FeedFilterBarProps {
  filters: FeedFilters;
  onChange: (filters: FeedFilters) => void;
  resultCount: number;
}

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipProps<T extends string> {
  option: ChipOption<T>;
  selected: boolean;
  onToggle: (value: T) => void;
}

interface ChipGroupProps<T extends string> {
  legend: string;
  options: readonly ChipOption<T>[];
  values: readonly T[];
  onToggle: (value: T) => void;
}

// Rebuilt from `options` rather than appended to `values`, so the selection
// always reads in the order the recruiter sees on screen.
const toggled = <T extends string>(
  options: readonly ChipOption<T>[],
  values: readonly T[],
  value: T,
): T[] => {
  const next = values.includes(value)
    ? values.filter((kept) => kept !== value)
    : [...values, value];

  return options.map((option) => option.value).filter((option) => next.includes(option));
};

const resultLabel = (count: number): string => {
  if (count === 0) {
    return 'Aucun profil ne correspond';
  }

  return count === 1 ? '1 profil correspond' : `${count} profils correspondent`;
};

// The row already shows which chips are pressed, so the count is spelled out
// for whoever cannot scan it. Once the panel is open the icon reads as a minus,
// and the name has to say the same thing.
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

function Chip<T extends string>({ option, selected, onToggle }: ChipProps<T>) {
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

function ChipGroup<T extends string>({ legend, options, values, onToggle }: ChipGroupProps<T>) {
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

/**
 * Two states behind one disclosure button: a single scrollable row of chips, and
 * a panel that names the two axes. The panel replaces the row instead of sitting
 * next to it, so no chip is ever rendered — or announced — twice.
 *
 * The disclosure button is a sibling of the scrollable row, never a child of it:
 * inside, it covered the last chip and captured the horizontal swipe.
 *
 * Layout-neutral on purpose: the page decides the width and where it sits.
 */
export function FeedFilterBar({ filters, onChange, resultCount }: FeedFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();

  const activeCount = activeFilterCount(filters);
  const hasActiveFilter = activeCount > 0;

  const changeContractTypes = (value: ContractType) =>
    onChange({
      ...filters,
      contractTypes: toggled(CONTRACT_TYPE_OPTIONS, filters.contractTypes, value),
    });

  const changeExperienceLevels = (value: ExperienceLevel) =>
    onChange({
      ...filters,
      experienceLevels: toggled(EXPERIENCE_LEVEL_OPTIONS, filters.experienceLevels, value),
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {!isExpanded && (
          <div
            role="group"
            aria-label="Filtres rapides"
            className="flex min-w-0 flex-1 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {CONTRACT_TYPE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                option={option}
                selected={filters.contractTypes.includes(option.value)}
                onToggle={changeContractTypes}
              />
            ))}
            {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                option={option}
                selected={filters.experienceLevels.includes(option.value)}
                onToggle={changeExperienceLevels}
              />
            ))}
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
          <ChipGroup<ContractType>
            legend="Type de contrat"
            options={CONTRACT_TYPE_OPTIONS}
            values={filters.contractTypes}
            onToggle={changeContractTypes}
          />

          <ChipGroup<ExperienceLevel>
            legend="Niveau d'expérience"
            options={EXPERIENCE_LEVEL_OPTIONS}
            values={filters.experienceLevels}
            onToggle={changeExperienceLevels}
          />

          {hasActiveFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-role"
              onClick={() => onChange(emptyFeedFilters)}
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
        {resultLabel(resultCount)}
      </p>
    </div>
  );
}
