import { describe, expect, it } from 'vitest';
import { activeOfferFilterCount, matchesOfferFilters } from './filters';
import { mockFeedOffers } from './mocks';
import { emptyOfferFeedFilters, type FeedOffer, type OfferFeedFilters } from './types';

const offer = (overrides: Partial<FeedOffer> = {}): FeedOffer => ({
  ...mockFeedOffers[0],
  ...overrides,
});

const filters = (overrides: Partial<OfferFeedFilters> = {}): OfferFeedFilters => ({
  ...emptyOfferFeedFilters,
  ...overrides,
});

describe('matchesOfferFilters', () => {
  it('laisse toutes les offres quand aucun filtre n’est sélectionné', () => {
    expect(mockFeedOffers.every((item) => matchesOfferFilters(item, emptyOfferFeedFilters))).toBe(
      true,
    );
  });

  it('combine les valeurs d’un groupe avec OU et les groupes avec ET', () => {
    expect(
      matchesOfferFilters(
        offer({ contractType: 'CDI', remotePolicy: 'FULL_REMOTE' }),
        filters({ contractTypes: ['CDI', 'CDD'], remotePolicies: ['FULL_REMOTE'] }),
      ),
    ).toBe(true);
    expect(
      matchesOfferFilters(
        offer({ contractType: 'CDI', remotePolicy: 'HYBRID' }),
        filters({ contractTypes: ['CDI'], remotePolicies: ['FULL_REMOTE'] }),
      ),
    ).toBe(false);
  });

  it('garde un groupe vide neutre', () => {
    expect(
      matchesOfferFilters(
        offer({ remotePolicy: 'HYBRID' }),
        filters({ remotePolicies: ['HYBRID'] }),
      ),
    ).toBe(true);
  });
});

describe('activeOfferFilterCount', () => {
  it('compte les sélections de chaque axe', () => {
    expect(
      activeOfferFilterCount(
        filters({ contractTypes: ['CDI', 'CDD'], remotePolicies: ['HYBRID'] }),
      ),
    ).toBe(3);
  });
});
