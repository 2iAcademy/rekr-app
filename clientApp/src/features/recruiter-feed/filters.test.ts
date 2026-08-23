import { describe, expect, it } from 'vitest';
import { activeFilterCount, matchesFilters } from './filters';
import { mockFeedCandidates } from './mocks';
import { emptyFeedFilters } from './types';
import type { FeedCandidate, FeedFilters } from './types';

const candidate = (overrides: Partial<FeedCandidate> = {}): FeedCandidate => ({
  ...mockFeedCandidates[0],
  ...overrides,
});

const filters = (overrides: Partial<FeedFilters> = {}): FeedFilters => ({
  ...emptyFeedFilters,
  ...overrides,
});

describe('matchesFilters', () => {
  it('n’écarte personne quand aucun filtre n’est posé', () => {
    expect(mockFeedCandidates.every((profile) => matchesFilters(profile, emptyFeedFilters))).toBe(
      true,
    );
  });

  it('retient le candidat dès qu’un seul de ses contrats est sélectionné', () => {
    expect(
      matchesFilters(
        candidate({ contractTypes: ['CDD', 'CDI'] }),
        filters({ contractTypes: ['CDI'] }),
      ),
    ).toBe(true);
  });

  it('additionne les valeurs à l’intérieur d’un groupe', () => {
    expect(
      matchesFilters(
        candidate({ contractTypes: ['FREELANCE'] }),
        filters({ contractTypes: ['STAGE', 'FREELANCE'] }),
      ),
    ).toBe(true);
  });

  it('écarte le candidat dont aucun contrat n’est sélectionné', () => {
    expect(
      matchesFilters(
        candidate({ contractTypes: ['INTERIM', 'CDD'] }),
        filters({ contractTypes: ['CDI'] }),
      ),
    ).toBe(false);
  });

  it('écarte le candidat sans contrat déclaré dès qu’un contrat est exigé', () => {
    const undeclared = candidate({ contractTypes: [] });

    expect(matchesFilters(undeclared, filters({ contractTypes: ['CDI'] }))).toBe(false);
    expect(matchesFilters(undeclared, emptyFeedFilters)).toBe(true);
  });

  it('filtre sur le niveau d’expérience', () => {
    const seniority = filters({ experienceLevels: ['SENIOR', 'EXPERT'] });

    expect(matchesFilters(candidate({ experienceLevel: 'SENIOR' }), seniority)).toBe(true);
    expect(matchesFilters(candidate({ experienceLevel: 'JUNIOR' }), seniority)).toBe(false);
  });

  it('exige de satisfaire les deux groupes à la fois', () => {
    const both = filters({ contractTypes: ['CDI'], experienceLevels: ['JUNIOR'] });

    expect(
      matchesFilters(candidate({ contractTypes: ['CDI'], experienceLevel: 'JUNIOR' }), both),
    ).toBe(true);
    expect(
      matchesFilters(candidate({ contractTypes: ['CDI'], experienceLevel: 'CONFIRME' }), both),
    ).toBe(false);
    expect(
      matchesFilters(candidate({ contractTypes: ['STAGE'], experienceLevel: 'JUNIOR' }), both),
    ).toBe(false);
  });

  it('laisse un groupe vide neutre quand l’autre est renseigné', () => {
    expect(
      matchesFilters(
        candidate({ contractTypes: ['INTERIM'], experienceLevel: 'CONFIRME' }),
        filters({ experienceLevels: ['CONFIRME'] }),
      ),
    ).toBe(true);
  });
});

describe('activeFilterCount', () => {
  it('ne compte rien quand aucun filtre n’est posé', () => {
    expect(activeFilterCount(emptyFeedFilters)).toBe(0);
  });

  it('totalise les valeurs de tous les groupes confondus', () => {
    expect(
      activeFilterCount(filters({ contractTypes: ['CDI', 'CDD'], experienceLevels: ['SENIOR'] })),
    ).toBe(3);
  });
});
