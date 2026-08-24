import { matchesFilters } from './filters';
import type { FeedCandidate, FeedFilters } from './types';

export type Decision = 'passed' | 'liked';

export type DeckDecisions = Readonly<Record<number, Decision>>;

// Frozen: the empty state is a module singleton shared by every mount, and
// `Readonly` alone would not stop a stray write from leaking across renders.
export const noDecisions: DeckDecisions = Object.freeze({});

export const recordDecision = (
  decisions: DeckDecisions,
  id: number,
  decision: Decision,
): DeckDecisions => ({ ...decisions, [id]: decision });

const isUndecided = (candidate: FeedCandidate, decisions: DeckDecisions): boolean =>
  decisions[candidate.id] === undefined;

export const remainingCandidates = (
  candidates: readonly FeedCandidate[],
  decisions: DeckDecisions,
  filters: FeedFilters,
): FeedCandidate[] =>
  candidates.filter(
    (candidate) => isUndecided(candidate, decisions) && matchesFilters(candidate, filters),
  );

export const likedCount = (decisions: DeckDecisions): number =>
  Object.values(decisions).filter((decision) => decision === 'liked').length;

const undecidedCount = (candidates: readonly FeedCandidate[], decisions: DeckDecisions): number =>
  candidates.filter((candidate) => isUndecided(candidate, decisions)).length;

export type EmptyReason = 'no-match' | 'exhausted';

/**
 * Filters are deliberately out of the picture: a profile still waiting for a
 * decision means the deck is not exhausted, so the empty screen must blame the
 * filters. When both causes hold, exhaustion wins — loosening filters would
 * bring nothing back.
 */
export const emptyReason = (
  candidates: readonly FeedCandidate[],
  decisions: DeckDecisions,
): EmptyReason => (undecidedCount(candidates, decisions) === 0 ? 'exhausted' : 'no-match');
