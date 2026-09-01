import type { Option } from '@/components/form/OptionCards';

/**
 * The offer lifecycle, in the order a recruiter walks it. The backend keeps
 * `status` a free field of the PATCH — there is no state machine — so this list
 * is the only place the front settles what an offer may be, and the recruiter
 * screens expose every transition between these five values.
 *
 * Vocabulary note: publishing an offer sets it to `open`. There is no
 * `published`.
 */
export const OFFER_STATUSES = ['draft', 'open', 'paused', 'filled', 'closed'] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

export type OfferStatusTone = 'neutral' | 'positive' | 'warning' | 'muted';

const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Brouillon',
  open: 'Publiée',
  paused: 'En pause',
  filled: 'Pourvue',
  closed: 'Fermée',
};

/**
 * How loudly each status is painted. `filled` and `closed` share `muted` on
 * purpose: both are the end of the offer's life and neither calls for the
 * recruiter's attention — what tells them apart is the wording.
 */
const OFFER_STATUS_TONES: Record<OfferStatus, OfferStatusTone> = {
  draft: 'neutral',
  open: 'positive',
  paused: 'warning',
  filled: 'muted',
  closed: 'muted',
};

/** French label shown to the recruiter for an offer status. */
export function offerStatusLabel(status: OfferStatus): string {
  return OFFER_STATUS_LABELS[status];
}

/** Colour intent of a status, resolved into design tokens by `StatusBadge`. */
export function offerStatusTone(status: OfferStatus): OfferStatusTone {
  return OFFER_STATUS_TONES[status];
}

/**
 * The API types `status` as a plain string. Narrowing it here is what keeps the
 * screens from casting their way to `OfferStatus` and rendering a status the
 * front has no label for.
 */
export function isOfferStatus(value: string): value is OfferStatus {
  return (OFFER_STATUSES as readonly string[]).includes(value);
}

/**
 * Ready for `OptionCards`. Derived rather than spelled out a second time: a
 * status selector and a badge must never disagree on the wording.
 */
export const OFFER_STATUS_OPTIONS = OFFER_STATUSES.map((status) => ({
  value: status,
  label: offerStatusLabel(status),
})) satisfies readonly Option<OfferStatus>[];
