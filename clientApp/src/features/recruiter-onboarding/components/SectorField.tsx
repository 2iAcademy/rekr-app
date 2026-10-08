import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSectors } from '../useSectors';

interface SectorFieldProps {
  value: string;
  onChange: (sectorId: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

export function SectorField({ value, onChange, invalid, describedBy }: SectorFieldProps) {
  const fieldId = useId();
  const { sectors, status, reload } = useSectors();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        Secteur
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
            'focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
            value === '' && 'text-muted-foreground',
          )}
        >
          <option value="">
            {status === 'loading' ? 'Chargement des secteurs…' : 'Choisissez un secteur'}
          </option>
          {sectors.map((sector) => (
            <option key={sector.id} value={String(sector.id)}>
              {sector.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted"
        />
      </div>

      {status === 'failed' && (
        <p role="alert" className="text-xs text-destructive">
          Impossible de charger les secteurs.{' '}
          <button type="button" onClick={reload} className="cursor-pointer font-semibold underline">
            Réessayer
          </button>
        </p>
      )}
    </div>
  );
}
