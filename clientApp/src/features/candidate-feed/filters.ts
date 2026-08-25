import type { FeedOffer, OfferFeedFilters } from './types';

const matchesGroup = <T>(selected: readonly T[], declared: readonly T[]): boolean =>
  selected.length === 0 || declared.some((value) => selected.includes(value));

export const matchesOfferFilters = (offer: FeedOffer, filters: OfferFeedFilters): boolean =>
  matchesGroup(filters.contractTypes, [offer.contractType]) &&
  matchesGroup(filters.remotePolicies, [offer.remotePolicy]);

export const activeOfferFilterCount = (filters: OfferFeedFilters): number =>
  filters.contractTypes.length + filters.remotePolicies.length;
