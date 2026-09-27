import { useId } from 'react';
import { Check, Star } from 'lucide-react';
import { OptionCards } from '@/components/form/OptionCards';
import { cn } from '@/lib/utils';
import { MAX_JOB_FAMILIES } from '@/lib/bounds';
import { jobFamilyIcon } from './jobFamilyIcons';
import { choosePrimaryJobFamily, toggleJobFamily } from './jobFamilySelection';
import { useJobFamilies } from './useJobFamilies';

interface JobFamilyChipsProps {
  /** Ordered: the first trade is the primary one. */
  values: string[];
  /**
   * False while the order of `values` is not a choice the candidate made — an
   * account older than the rank. Nothing is starred or preselected then.
   */
  primaryChosen?: boolean;
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
export function JobFamilyChips({
  values,
  onChange,
  primaryChosen = true,
  ...aria
}: JobFamilyChipsProps) {
  const legendId = useId();
  const primaryName = useId();
  const { jobFamilies, status, reload } = useJobFamilies();

  const full = values.length >= MAX_JOB_FAMILIES;
  const reference = jobFamilies.map(({ id }) => String(id));
  const labelOf = (id: string): string =>
    jobFamilies.find((family) => String(family.id) === id)?.label ?? id;

  const toggle = (id: string): void => {
    const next = toggleJobFamily(values, id, reference);

    if (next !== values) {
      onChange(next);
    }
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
        <p id={legendId} className="text-xs text-ink-muted">
          Domaine(s) recherché(s)
        </p>
        {/* The count replaces « 3 au maximum »: it says the same rule and, once
            the cap is reached, explains why the other pills stop responding. */}
        <p
          aria-live="polite"
          className={cn(
            'text-xs tabular-nums transition-colors',
            full ? 'font-semibold text-role' : 'text-ink-muted',
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
            // Marked only when there is something to rank it above.
            const primary = primaryChosen && values[0] === id && values.length > 1;
            // The mark replaces the check rather than adding a badge: a wider
            // pill pushed every pill after it along the line, and a tap aimed
            // at one trade landed on the next.
            const Icon = primary ? Star : selected ? Check : jobFamilyIcon(family.label);

            return (
              <label
                key={family.id}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-full pr-4 pl-3 text-sm whitespace-nowrap',
                  'transition-all duration-150 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-role/40',
                  selected
                    ? 'bg-role-gradient font-semibold text-white shadow-role'
                    : 'border border-line bg-card text-ink',
                  // The cap dims what it forbids instead of hiding it: the
                  // candidate keeps seeing the trades they did not pick.
                  !selected && full
                    ? 'cursor-not-allowed opacity-45'
                    : 'cursor-pointer hover:border-role/40 hover:shadow-sm',
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
                    selected ? 'text-white' : 'text-role',
                    primary && 'fill-current',
                  )}
                />
                {family.label}
                {primary && (
                  <>
                    {' '}
                    <span className="sr-only">(principal)</span>
                  </>
                )}
              </label>
            );
          })
        )}
      </div>

      {/* Asked only once there is something to rank: with a single trade the
          primary is not a choice. The first trade ticked is the default, but
          the question stays on screen so it reads as a decision, not as an
          accident of which pill was clicked first. */}
      {status === 'ready' && values.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <OptionCards
            legend="Lequel compte le plus ?"
            name={primaryName}
            // In the order of the chips, not of the selection: sorted by
            // preference, the option just clicked jumped to the left.
            options={reference
              .filter((id) => values.includes(id))
              .map((id) => ({ value: id, label: labelOf(id) }))}
            value={primaryChosen ? values[0] : ''}
            onChange={(id) => onChange(choosePrimaryJobFamily(values, id, reference))}
            columns={values.length === 2 ? 2 : 3}
          />
          <p className="text-xs text-ink-muted">
            Ses offres passent un peu plus haut ; les autres restent dans votre feed.
          </p>
        </div>
      )}
    </div>
  );
}
