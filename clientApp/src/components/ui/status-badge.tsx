import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { offerStatusLabel, offerStatusTone, type OfferStatus } from '@/domain/offerStatus';

/**
 * Kept module-private, unlike `chipVariants`: a chip is a recipe several
 * elements borrow, whereas a status is always rendered by this component — the
 * tone must not be pickable independently of the status it stands for.
 *
 * Status colours are semantic, not the brand accent: a published offer reads as
 * a go, a paused one as a caution, whichever side of the product looks at it.
 */
const statusBadgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-card text-ink-soft',
        positive: 'border-transparent bg-success-tint text-success',
        warning: 'border-transparent bg-amber-100 text-amber-800',
        muted: 'border-transparent bg-surface text-ink-muted',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

interface StatusBadgeProps extends Omit<ComponentProps<'span'>, 'children' | 'role'> {
  status: OfferStatus;
}

/**
 * The status of an offer, as read by the recruiter.
 *
 * `role="status"` rather than a plain `span`: the badge is the one thing on the
 * row that changes when an offer is published, paused or closed, and that
 * change is the confirmation the recruiter needs. A live region announces
 * nothing on first render, so a list of them stays silent until one actually
 * moves.
 *
 * The accessible name carries the subject — « Statut : Publiée » — because
 * « Fermée », announced on its own, says nothing about what is closed.
 */
function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const label = offerStatusLabel(status);

  return (
    <span
      {...props}
      data-slot="status-badge"
      data-status={status}
      role="status"
      aria-label={`Statut : ${label}`}
      className={cn(statusBadgeVariants({ tone: offerStatusTone(status) }), className)}
    >
      {label}
    </span>
  );
}

export { StatusBadge };
