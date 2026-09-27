import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import type { OfferListItemDto } from '@/api/generated';
import { contractLabel, metaLine, offerSalaryLabel } from '@/components/feed/labels';
import { buttonVariants } from '@/components/ui/button-variants';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OfferStatus } from '@/domain/offerStatus';
import { cn } from '@/lib/utils';
import type { ApplicantsLocationState } from '@/features/recruiter-candidates/offerContext';
import { OfferStatusSelect } from './OfferStatusSelect';

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
 * Two columns on mobile — the offer and its count of interested candidates —
 * with the actions underneath; a single line from `md:` up.
 */
export function OfferRow({ offer, statusPending = false, onStatusChange }: OfferRowProps) {
  const { title, status, city, contractType, salaryMin, salaryMax, applicantCount } = offer;
  const applicantsState: ApplicantsLocationState = { offerTitle: title };

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 rounded-2xl border border-line bg-card p-4 shadow-card md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-6 md:p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {/* No `aria-label` and no link on the title: a link would become the
              accessible name of the heading that wraps it, and the way in to
              who applied already has its own named target on the right. */}
          <h2 className="text-base font-bold break-words text-ink md:text-lg">{title}</h2>
          {/* Kept for assistive tech only: it is the live region that announces
              a status change, while the select below already shows the value. */}
          <StatusBadge status={status} className="sr-only" />
        </div>

        <p className="text-sm break-words text-ink-muted">
          {metaLine([city, contractType ? contractLabel(contractType) : null])}
        </p>
        <p className="tabular text-sm font-semibold text-ink-soft">
          {offerSalaryLabel(salaryMin, salaryMax)}
        </p>
      </div>

      {/* The way in to who applied, said out loud rather than hidden behind the
          title: this is what the recruiter comes to the list for, and a link
          that only appears on hover is unreachable on a touch screen.

          Always shown, zero included: hidden at zero, nothing on the row said
          that the offer leads anywhere, and a recruiter whose offers had no
          applicant yet could not discover the screen at all. The number and its
          label read as one sentence — « 3 candidats intéressés ». */}
      <Link
        to={`/recruteur/offres/${offer.id}/candidats`}
        state={applicantsState}
        className="-my-1 flex min-h-11 items-center gap-1.5 self-center rounded-xl py-1 pl-2 transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none md:-mr-2 md:pr-1"
      >
        <span className="flex flex-col items-end text-right">
          <span
            className={cn(
              'tabular text-xl leading-tight font-extrabold',
              applicantCount > 0 ? 'text-ink' : 'text-ink-muted',
            )}
          >
            {applicantCount}
          </span>{' '}
          {/* « candidats » only reaches the eye from `sm`: on a phone the column
              would squeeze the title; the accessible name keeps the whole phrase. */}
          <span className="text-xs whitespace-nowrap text-ink-muted">
            <span className="sr-only sm:not-sr-only">
              {applicantCount > 1 ? 'candidats' : 'candidat'}
            </span>{' '}
            {applicantCount > 1 ? 'intéressés' : 'intéressé'}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-faint" />
      </Link>

      <div className="col-span-2 flex items-center gap-2 border-t border-line pt-4 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1 md:col-span-1 md:[&>*:first-child]:flex-none md:border-t-0 md:pt-0">
        <OfferStatusSelect
          value={status}
          offerTitle={title}
          disabled={statusPending}
          onChange={onStatusChange}
        />

        <Link
          to={`/recruteur/offres/${offer.id}/edition`}
          aria-label={`Modifier l’offre ${title}`}
          className={cn(buttonVariants({ variant: 'outline' }), 'h-11 rounded-xl px-4')}
        >
          Modifier
        </Link>
      </div>
    </li>
  );
}
