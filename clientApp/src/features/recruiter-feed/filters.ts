import type { FeedCandidate, FeedFilters } from './types';

// An untouched group selects nothing, which means it excludes nobody: the
// recruiter opening the feed sees the whole deck, not an empty one.
const matchesGroup = <T>(selected: readonly T[], declared: readonly T[]): boolean =>
  selected.length === 0 || declared.some((value) => selected.includes(value));

export const matchesFilters = (candidate: FeedCandidate, filters: FeedFilters): boolean =>
  matchesGroup(filters.contractTypes, candidate.contractTypes) &&
  matchesGroup(filters.experienceLevels, [candidate.experienceLevel]);

export const activeFilterCount = (filters: FeedFilters): number =>
  filters.contractTypes.length + filters.experienceLevels.length;
