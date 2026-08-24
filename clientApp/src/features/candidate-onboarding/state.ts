import type { Availability, ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';

/**
 * How far the candidate is willing to go, as the form asks it: a nationwide
 * answer and a radius are exclusive, and only the second one carries a number.
 * The API stores the pair (`mobilityNationwide`, `mobilityRadiusKm`), which
 * `buildCandidateProfilePayload` derives from this single choice.
 */
export const MOBILITY_SCOPES = ['NATIONWIDE', 'RADIUS'] as const;

export type MobilityScope = (typeof MOBILITY_SCOPES)[number];

/**
 * Every field is held as a string (or `''` for an unset enum) because that is
 * what the inputs produce. Coercion to the API shape happens once, in
 * `buildCandidateProfilePayload`.
 *
 * `city` and `postalCode` are written together by `CityField` from one entry of
 * the national address reference, and cleared together as soon as the text is
 * edited again. The coordinates are not held here: the API derives them from
 * the pair, so a client cannot show one commune and be matched at another.
 */
export interface CandidateOnboardingState {
  firstName: string;
  lastName: string;
  city: string;
  postalCode: string;
  desiredJobTitle: string;
  contractTypes: ContractType[];
  experienceLevel: ExperienceLevel | '';
  availability: Availability | '';
  availabilityDelayMonths: string;
  availabilityDate: string;
  remotePolicy: RemotePolicy | '';
  mobilityScope: MobilityScope | '';
  mobilityRadiusKm: string;
  salaryMin: string;
  salaryMax: string;
  skills: string[];
  languages: string[];
  bio: string;
  linkedinUrl: string;
}

export const emptyCandidateOnboarding: CandidateOnboardingState = {
  firstName: '',
  lastName: '',
  city: '',
  postalCode: '',
  desiredJobTitle: '',
  contractTypes: [],
  experienceLevel: '',
  availability: '',
  availabilityDelayMonths: '',
  availabilityDate: '',
  remotePolicy: '',
  mobilityScope: '',
  mobilityRadiusKm: '',
  salaryMin: '',
  salaryMax: '',
  skills: [],
  languages: [],
  bio: '',
  linkedinUrl: '',
};
