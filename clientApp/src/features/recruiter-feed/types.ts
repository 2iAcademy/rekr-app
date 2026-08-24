import type { Availability, ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';

/**
 * What a recruiter needs to decide on one swipe. This is a view model, not the
 * API shape: no endpoint lists swipeable candidates yet (see #135), so the deck
 * is fed from `mocks.ts`.
 *
 * `age` and `portfolioUrl` have no counterpart in the Prisma profile either:
 * both are simply omitted when unknown, so the screens stay honest once the
 * endpoint lands with or without them.
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
  mobilityRadiusKm: number | null;
  mobilityNationwide: boolean | null;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
  languages: string[];
  bio: string;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  // A storage key such as `candidates/1/cv/<uuid>.pdf`, never an absolute URL.
  cvUrl: string | null;
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
