import { useId } from 'react';
import { OFFER_STATUS_OPTIONS, type OfferStatus } from '@/domain/offerStatus';
import { cn } from '@/lib/utils';

interface OfferStatusSelectProps {
  value: OfferStatus;
  /** Names the offer in the accessible label — see below. */
  offerTitle: string;
  disabled?: boolean;
  onChange: (status: OfferStatus) => void;
}

/**
 * Moves one offer to any of the five statuses. The backend keeps `status` a
 * free field of the PATCH, so no transition is forbidden here either — a closed
 * offer can go back to draft.
 *
 * A native `<select>` styled with the design tokens, like `SectorField`: the
 * design system has no dropdown, and five mutually exclusive values in a dense
 * list are exactly what the platform control already does well — including the
 * touch keyboard on mobile.
 *
 * The label is hidden but carries the offer title: a list shows one of these
 * selectors per row, and a screen reader running through the form controls
 * would otherwise hear « Statut » five times over with nothing to tell them
 * apart.
 */
export function OfferStatusSelect({
  value,
  offerTitle,
  disabled = false,
  onChange,
}: OfferStatusSelectProps) {
  const fieldId = useId();

  return (
    <>
      <label htmlFor={fieldId} className="sr-only">
        {`Statut de l’offre ${offerTitle}`}
      </label>
      <select
        id={fieldId}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as OfferStatus)}
        className={cn(
          'h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none transition-colors',
          'focus-visible:border-role focus-visible:ring-3 focus-visible:ring-role/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'md:w-44',
        )}
      >
        {OFFER_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
