import type { EmptyReason } from '@/components/feed/deck';

export const offerDeckTitle = (reason: EmptyReason): string =>
  reason === 'no-match' ? 'Aucune offre ne passe vos filtres' : 'Tu as tout vu';

export const likedOfferCountLabel = (count: number): string =>
  count === 0 ? 'Aucune offre likée' : count === 1 ? '1 offre likée' : `${count} offres likées`;
