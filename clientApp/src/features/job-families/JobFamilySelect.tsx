import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobFamilies } from './useJobFamilies';

interface JobFamilySelectProps {
  value: string;
  onChange: (jobFamilyId: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * The trade an offer belongs to, picked from the reference list rather than
 * typed: the feed compares identifiers, never words, so « Développeur » and
 * « Dev » have to resolve to the same row for the match to work at all.
 */
export function JobFamilySelect({ value, onChange, invalid, describedBy }: JobFamilySelectProps) {
  const fieldId = useId();
  const { jobFamilies, status, reload } = useJobFamilies();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        Domaine du poste
      </label>

      <div className="relative">
        <select
          id={fieldId}
          aria-required
          aria-invalid={invalid ?? false}
          aria-describedby={describedBy}
          disabled={status !== 'ready'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'h-12 w-full cursor-pointer appearance-none rounded-xl border border-line bg-card pr-11 pl-4 text-sm text-ink outline-none transition-colors',
            'hover:border-ink-faint/40',
            'focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
            value === '' && 'text-ink-muted',
          )}
        >
          <option value="">
            {status === 'loading' ? 'Chargement des domaines…' : 'Choisissez un domaine'}
          </option>
          {jobFamilies.map((family) => (
            <option key={family.id} value={String(family.id)}>
              {family.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-soft"
        />
      </div>

      {status === 'failed' && (
        <p role="alert" className="text-xs text-destructive">
          Impossible de charger les domaines.{' '}
          <button type="button" onClick={reload} className="cursor-pointer underline">
            Réessayer
          </button>
        </p>
      )}
    </div>
  );
}
