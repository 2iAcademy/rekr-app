import { describe, expect, it } from 'vitest';
import { emptyReason, likedCount, noDecisions, recordDecision, remainingCandidates } from './deck';
import type { DeckDecisions } from './deck';
import { mockFeedCandidates } from './mocks';
import { emptyFeedFilters } from './types';
import type { FeedFilters } from './types';

const deck = mockFeedCandidates;

const ids = (filters: FeedFilters, decisions: DeckDecisions = noDecisions): number[] =>
  remainingCandidates(deck, decisions, filters).map((candidate) => candidate.id);

const decideAll = (decision: 'passed' | 'liked'): DeckDecisions =>
  deck.reduce<DeckDecisions>(
    (decisions, candidate) => recordDecision(decisions, candidate.id, decision),
    noDecisions,
  );

const onlyContracts = (contractTypes: FeedFilters['contractTypes']): FeedFilters => ({
  ...emptyFeedFilters,
  contractTypes,
});

describe('recordDecision', () => {
  it('laisse l’état reçu intact et en retourne un nouveau', () => {
    const first = recordDecision(noDecisions, 1, 'liked');
    const second = recordDecision(first, 2, 'passed');

    expect(noDecisions).toEqual({});
    expect(first).toEqual({ 1: 'liked' });
    expect(second).toEqual({ 1: 'liked', 2: 'passed' });
  });

  it('écrase une décision déjà prise sur le même candidat', () => {
    const decisions = recordDecision(recordDecision(noDecisions, 1, 'passed'), 1, 'liked');

    expect(decisions).toEqual({ 1: 'liked' });
    expect(likedCount(decisions)).toBe(1);
  });
});

describe('remainingCandidates', () => {
  it('retire les candidats déjà tranchés, passés comme retenus', () => {
    const decisions = recordDecision(recordDecision(noDecisions, 1, 'liked'), 2, 'passed');

    expect(ids(emptyFeedFilters, decisions)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('cumule les décisions et les filtres', () => {
    const decisions = recordDecision(noDecisions, 1, 'passed');

    expect(ids(onlyContracts(['CDI']), decisions)).toEqual([2, 3, 4, 5]);
  });

  it('conserve l’ordre du deck quand un filtre s’élargit', () => {
    expect(ids(onlyContracts(['CDI']))).toEqual([1, 2, 3, 4, 5]);
    expect(ids(onlyContracts(['CDI', 'FREELANCE']))).toEqual([1, 2, 3, 4, 5, 7]);
  });

  it('se vide quand les filtres ne croisent aucun profil', () => {
    expect(ids({ contractTypes: ['STAGE'], experienceLevels: ['EXPERT'] })).toEqual([]);
  });
});

describe('likedCount', () => {
  it('ne compte que les profils retenus', () => {
    const decisions = recordDecision(
      recordDecision(recordDecision(noDecisions, 1, 'liked'), 2, 'passed'),
      3,
      'liked',
    );

    expect(likedCount(decisions)).toBe(2);
  });
});

describe('emptyReason', () => {
  it('accuse les filtres tant qu’il reste des profils à trancher', () => {
    expect(emptyReason(deck, noDecisions)).toBe('no-match');
    expect(emptyReason(deck, recordDecision(noDecisions, 1, 'liked'))).toBe('no-match');
  });

  it('annonce un deck épuisé quand tous les profils ont été tranchés', () => {
    expect(emptyReason(deck, decideAll('passed'))).toBe('exhausted');
  });

  it('tranche pour l’épuisement quand les deux causes se recouvrent', () => {
    const decisions = decideAll('liked');

    expect(ids(onlyContracts(['STAGE']), decisions)).toEqual([]);
    expect(emptyReason(deck, decisions)).toBe('exhausted');
  });

  it('annonce un deck épuisé plutôt que des filtres trop serrés sur un deck vide', () => {
    expect(emptyReason([], noDecisions)).toBe('exhausted');
  });
});
