import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import type { OfferListItemDto } from '@/api/generated';
import { contractLabel, metaLine, offerSalaryLabel } from '@/components/feed/labels';
import { buttonVariants } from '@/components/ui/button-variants';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OfferStatus } from '@/domain/offerStatus';
import { cn } from '@/lib/utils';
import { OfferStatusSelect } from './OfferStatusSelect';

/**
 * Always shown, zero included.
 *
 * Hiding it at zero left nothing on the row to say that the offer leads
 * anywhere — the title was a link, but only a hover revealed it, and a
 * recruiter whose offers had no applicant yet had no way to discover the screen
 * at all. « Aucun candidat » is an answer; silence was not.
 */
const applicantLabel = (count: number): string => {
  if (count === 0) {
    return 'Aucun candidat intéressé';
  }

  return count === 1 ? '1 candidat intéressé' : `${count} candidats intéressés`;
};

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
            {title}
          </h2>
          <StatusBadge status={status} />
        </div>

        <p className="text-sm break-words text-ink-muted">
          {metaLine([city, contractType ? contractLabel(contractType) : null])}
        </p>
        <p className="text-sm font-semibold text-ink">{offerSalaryLabel(salaryMin, salaryMax)}</p>

        {/* The way in to who applied, said out loud rather than hidden behind
            the title: this is what the recruiter comes to the list for, and a
            link that only appears on hover is unreachable on a touch screen. */}
        <Link
          to={`/recruteur/offres/${offer.id}/candidats`}
          className={cn(
            'inline-flex items-center gap-1 self-start rounded-lg text-sm font-semibold underline-offset-4 hover:underline',
            applicantCount > 0 ? 'text-role' : 'text-ink-muted',
          )}
        >
          {applicantLabel(applicantCount)}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
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
