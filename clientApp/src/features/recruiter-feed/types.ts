import type { Availability, ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';

/**
 * What a recruiter needs to decide on one swipe. This is a view model, not the
 * API shape: no endpoint lists swipeable candidates yet (see #135), so the deck
 * is fed from `mocks.ts`.
 *
 * `age` has no counterpart in the Prisma profile either — the card shows the
 * name alone when it is unknown, so the screen stays honest once the endpoint
 * lands with or without it.
 */
export interface FeedCandidate {
  id: number;
  firstName: string;
  lastName: string;
  age: number | null;
  city: string | null;
  avatarUrl: string | null;
  desiredJobTitle: string;
  experienceLevel: ExperienceLevel;
  contractTypes: ContractType[];
  availability: Availability;
  availabilityDelayMonths: number | null;
  availabilityDate: string | null;
  remotePolicy: RemotePolicy;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
  languages: string[];
  bio: string;
  linkedinUrl: string | null;
}

/**
 * The two axes the recruiter filters on. Both are multi-select: values inside a
 * group widen the deck (OR), the groups narrow it together (AND).
 */
export interface FeedFilters {
  readonly contractTypes: readonly ContractType[];
  readonly experienceLevels: readonly ExperienceLevel[];
}

// Frozen, arrays included: this is a module singleton, and a stray push would
// corrupt the reset state for the whole application.
export const emptyFeedFilters: FeedFilters = Object.freeze({
  contractTypes: Object.freeze([]),
  experienceLevels: Object.freeze([]),
});
