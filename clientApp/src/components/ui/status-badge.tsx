import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { offerStatusLabel, offerStatusTone, type OfferStatus } from '@/domain/offerStatus';

/**
 * Kept module-private, unlike `chipVariants`: a chip is a recipe several
 * elements borrow, whereas a status is always rendered by this component — the
 * tone must not be pickable independently of the status it stands for.
 *
 * Every tone pairs a tinted surface with an ink or brand foreground rather than
 * colouring the text with the accent itself: `coral` and `role` are too light
 * to carry text at this size. Nothing is hard-coded, so the recruiter palette —
 * which redefines `--line` — repaints the neutral badge along with the rest of
 * the chrome.
 */
const statusBadgeVariants = cva(
  'inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-card text-ink-soft',
        positive: 'border-transparent bg-brand-tint text-brand-strong',
        warning: 'border-transparent bg-coral/20 text-ink',
        muted: 'border-transparent bg-ink/5 text-ink-muted',
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
