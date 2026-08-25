import { remainingItems, type DeckDecisions } from '@/components/feed/deck';
import { matchesFilters } from './filters';
import type { FeedCandidate, FeedFilters } from './types';

export const remainingCandidates = (
  candidates: readonly FeedCandidate[],
  decisions: DeckDecisions,
  filters: FeedFilters,
): FeedCandidate[] =>
  remainingItems(candidates, decisions, (candidate) => matchesFilters(candidate, filters));
