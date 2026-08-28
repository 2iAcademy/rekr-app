import { Link } from 'react-router';
import type { OfferListItemDto } from '@/api/generated';
import { contractLabel, metaLine, offerSalaryLabel } from '@/components/feed/labels';
import { buttonVariants } from '@/components/ui/button-variants';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OfferStatus } from '@/domain/offerStatus';
import { cn } from '@/lib/utils';
import { OfferStatusSelect } from './OfferStatusSelect';

// Zero is a state, not a quantity: the badge is dropped rather than showing
// « 0 intéressé », which reads like a scoreboard.
const applicantLabel = (count: number): string =>
  count === 1 ? '1 intéressé' : `${count} intéressés`;

interface OfferRowProps {
  offer: OfferListItemDto;
  /** The status write for this offer is in flight. */
  statusPending?: boolean;
  onStatusChange: (status: OfferStatus) => void;
}

/**
 * One offer in the recruiter's list. Purely presentational: it owns neither the
 * request nor the resulting status, so the badge only ever paints what the
 * parent holds — never the value just picked in the selector.
 *
 * Stacked on mobile, split into a description and an action column from `md:`
 * up, where the row is wide enough for the two to sit side by side.
 */
export function OfferRow({ offer, statusPending = false, onStatusChange }: OfferRowProps) {
  const { title, status, city, contractType, salaryMin, salaryMax, applicantCount } = offer;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:gap-6 md:p-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* The title is the way in to who applied: that screen is what the
              recruiter comes to this list for, so it gets the primary target
              rather than a third button in the action column.

              No `aria-label` on the link: it would become the accessible name
              of the heading that wraps it, so the offer would stop being
              announced by its own title. The title is the destination — that is
              exactly what a link should say. */}
          <h2 className="font-heading text-base font-bold break-words text-ink md:text-lg">
            <Link
              to={`/recruteur/offres/${offer.id}/candidats`}
              className="underline-offset-4 hover:underline"
            >
              {title}
            </Link>
          </h2>
          <StatusBadge status={status} />
          {applicantCount > 0 && (
            <span className="rounded-full bg-role/10 px-2 py-0.5 text-xs font-semibold text-role">
              {applicantLabel(applicantCount)}
            </span>
          )}
        </div>

        <p className="text-sm break-words text-ink-muted">
          {metaLine([city, contractType ? contractLabel(contractType) : null])}
        </p>
        <p className="text-sm font-semibold text-ink">{offerSalaryLabel(salaryMin, salaryMax)}</p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center md:gap-3">
        <OfferStatusSelect
          value={status}
          offerTitle={title}
          disabled={statusPending}
          onChange={onStatusChange}
        />

        <Link
          to={`/recruteur/offres/${offer.id}/edition`}
          aria-label={`Modifier l’offre ${title}`}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'h-11 justify-center px-4 md:w-auto',
          )}
        >
          Modifier
        </Link>
      </div>
    </li>
  );
}
