import { useId } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_JOB_FAMILIES } from '@/lib/bounds';
import { jobFamilyIcon } from './jobFamilyIcons';
import { useJobFamilies } from './useJobFamilies';

interface JobFamilyChipsProps {
  values: string[];
  onChange: (values: string[]) => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * The trades the candidate is looking for, which decide what their feed can
 * contain at all.
 *
 * Several rather than one so a reconversion or a double skill set stays
 * expressible, but capped: past three the filter stops filtering, and a deck
 * spanning six trades is the bucket this whole feature exists to close.
 *
 * Laid out as pills that flow on the line, each carrying its own icon. Not the
 * fixed grid `OptionChips` draws: that grid suits six short contract names,
 * whereas twenty trades of similar length and colour give the eye nothing to
 * land on — the icon is what turns reading the list into scanning it.
 */
export function JobFamilyChips({ values, onChange, ...aria }: JobFamilyChipsProps) {
  const legendId = useId();
  const { jobFamilies, status, reload } = useJobFamilies();

  const full = values.length >= MAX_JOB_FAMILIES;

  // Rebuilt from the reference list rather than appended to, so the selection
  // always reads in the order shown on screen.
  const toggle = (id: string): void => {
    const next = values.includes(id) ? values.filter((kept) => kept !== id) : [...values, id];

    // Refused on the way in rather than by disabling the untaken pills: a
    // disabled pill reads as « unavailable » when it means « deselect one
    // first ».
    if (next.length > MAX_JOB_FAMILIES) {
      return;
    }

    onChange(
      jobFamilies.map(({ id: known }) => String(known)).filter((known) => next.includes(known)),
    );
  };

  if (status === 'failed') {
    return (
      <p role="alert" className="text-xs text-destructive">
        Impossible de charger les domaines.{' '}
        <button type="button" onClick={reload} className="cursor-pointer underline">
          Réessayer
        </button>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p id={legendId} className="text-sm font-semibold text-ink">
          Domaine(s) recherché(s)
        </p>
        {/* The count replaces « 3 au maximum »: it says the same rule and, once
            the cap is reached, explains why the other pills stop responding. */}
        <p
          aria-live="polite"
          className={cn(
            'tabular text-xs transition-colors',
            full ? 'font-semibold text-ink' : 'text-ink-muted',
          )}
        >
          {values.length} / {MAX_JOB_FAMILIES}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby={legendId}
        aria-invalid={aria['aria-invalid']}
        aria-describedby={aria['aria-describedby']}
        className="flex flex-wrap gap-2"
      >
        {status === 'loading' ? (
          <p className="text-sm text-ink-muted">Chargement des domaines…</p>
        ) : (
          jobFamilies.map((family) => {
            const id = String(family.id);
            const selected = values.includes(id);
            const Icon = selected ? Check : jobFamilyIcon(family.label);

            return (
              <label
                key={family.id}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-xl border pr-4 pl-3 text-sm whitespace-nowrap',
                  'transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand/30',
                  selected
                    ? 'border-brand bg-brand-tint font-semibold text-brand-strong'
                    : 'border-line bg-card text-ink',
                  // The cap dims what it forbids instead of hiding it: the
                  // candidate keeps seeing the trades they did not pick.
                  !selected && full ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                  !selected && !full && 'hover:border-ink-faint/40',
                )}
              >
                <input
                  type="checkbox"
                  name="candidate-job-families"
                  value={id}
                  checked={selected}
                  onChange={() => toggle(id)}
                  className="sr-only"
                />
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0',
                    selected ? 'text-brand-strong' : 'text-ink-soft',
                  )}
                />
                {family.label}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
