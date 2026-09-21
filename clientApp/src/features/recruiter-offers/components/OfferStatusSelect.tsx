import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  OFFER_STATUS_OPTIONS,
  offerStatusTone,
  type OfferStatus,
  type OfferStatusTone,
} from '@/domain/offerStatus';
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
 * A native `<select>` dressed like the text inputs: the design system has no
 * dropdown, and five mutually exclusive values in a dense list are exactly what
 * the platform control already does well — including the touch keyboard on
 * mobile. The platform arrow is replaced by a lucide chevron so the control
 * looks the same on every browser.
 *
 * The label is hidden but carries the offer title: a list shows one of these
 * selectors per row, and a screen reader running through the form controls
 * would otherwise hear « Statut » five times over with nothing to tell them
 * apart.
 */
/** The status colour moves onto the control, since it is the one place the value shows. */
const TONE_DOT: Record<OfferStatusTone, string> = {
  neutral: 'bg-ink-faint',
  positive: 'bg-success',
  warning: 'bg-amber-500',
  muted: 'bg-ink-faint/40',
};

export function OfferStatusSelect({
  value,
  offerTitle,
  disabled = false,
  onChange,
}: OfferStatusSelectProps) {
  const fieldId = useId();

  return (
    <div className="relative w-full md:w-44">
      <label htmlFor={fieldId} className="sr-only">
        {`Statut de l’offre ${offerTitle}`}
      </label>
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 left-3.5 size-2 -translate-y-1/2 rounded-full',
          TONE_DOT[offerStatusTone(value)],
        )}
      />
      <select
        id={fieldId}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as OfferStatus)}
        className={cn(
          'h-11 w-full cursor-pointer appearance-none rounded-xl border border-input bg-card pr-10 pl-8 text-sm font-semibold text-ink outline-none transition-colors',
          'hover:border-ink-faint/40 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {OFFER_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
