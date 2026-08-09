import type { Availability, ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';
import {
  optionalEnum,
  optionalInteger,
  optionalList,
  optionalText,
  withoutEmptyFields,
} from '@/lib/payload';
import type { CandidateOnboardingState } from './state';

/**
 * Declared as a type alias, not an interface: orval types the generated DTOs as
 * `{ [key: string]: unknown }` (the Nest DTOs carry no `@ApiProperty`), and only
 * an object type alias gets the implicit index signature that makes it
 * assignable to one.
 */
export type CandidateProfilePayload = {
  firstName: string;
  lastName: string;
  city?: string;
  postalCode?: string;
  desiredJobTitle?: string;
  contractTypes?: ContractType[];
  experienceLevel?: ExperienceLevel;
  availability?: Availability;
  availabilityDelayMonths?: number;
  availabilityDate?: string;
  remotePolicy?: RemotePolicy;
  mobilityNationwide?: boolean;
  mobilityRadiusKm?: number;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  languages?: string[];
  bio?: string;
  linkedinUrl?: string;
};

/**
 * `availabilityDelayMonths` and `availabilityDate` belong to one answer each.
 * Sending the one that does not match would store a delay the candidate has
 * since replaced by a date, and the profile would advertise both.
 */
const availabilityDelay = (state: CandidateOnboardingState): number | undefined =>
  state.availability === 'WITHIN_DELAY'
    ? optionalInteger(state.availabilityDelayMonths)
    : undefined;

const availabilityDate = (state: CandidateOnboardingState): string | undefined =>
  state.availability === 'SPECIFIC_DATE' ? optionalText(state.availabilityDate) : undefined;

// The form asks one question; the API stores a flag and a radius. A radius sent
// alongside a nationwide answer would contradict it.
const mobilityNationwide = (state: CandidateOnboardingState): boolean | undefined =>
  state.mobilityScope === '' ? undefined : state.mobilityScope === 'NATIONWIDE';

const mobilityRadius = (state: CandidateOnboardingState): number | undefined =>
  state.mobilityScope === 'RADIUS' ? optionalInteger(state.mobilityRadiusKm) : undefined;

export const buildCandidateProfilePayload = (
  state: CandidateOnboardingState,
): CandidateProfilePayload =>
  withoutEmptyFields({
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    city: optionalText(state.city),
    postalCode: optionalText(state.postalCode),
    desiredJobTitle: optionalText(state.desiredJobTitle),
    contractTypes: optionalList(state.contractTypes),
    experienceLevel: optionalEnum(state.experienceLevel),
    availability: optionalEnum(state.availability),
    availabilityDelayMonths: availabilityDelay(state),
    availabilityDate: availabilityDate(state),
    remotePolicy: optionalEnum(state.remotePolicy),
    mobilityNationwide: mobilityNationwide(state),
    mobilityRadiusKm: mobilityRadius(state),
    salaryMin: optionalInteger(state.salaryMin),
    salaryMax: optionalInteger(state.salaryMax),
    skills: optionalList(state.skills),
    languages: optionalList(state.languages),
    bio: optionalText(state.bio),
    linkedinUrl: optionalText(state.linkedinUrl),
  });
