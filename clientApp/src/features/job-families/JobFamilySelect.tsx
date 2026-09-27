import { useId } from 'react';
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
      <label htmlFor={fieldId} className="text-xs text-ink-muted">
        Domaine du poste
      </label>

      <select
        id={fieldId}
        aria-required
        aria-invalid={invalid ?? false}
        aria-describedby={describedBy}
        disabled={status !== 'ready'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-12 w-full rounded-xl border border-line bg-card px-4 text-sm text-ink outline-none transition-colors',
          'focus-visible:border-role focus-visible:ring-3 focus-visible:ring-role/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
          value === '' && 'text-muted-foreground',
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
