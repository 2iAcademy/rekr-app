import type { CandidateProfileResponseDto } from '@/api/generated';
import type { Option } from '@/components/form/OptionCards';
import type { Availability, ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';
import { withoutEmptyFields } from '@/lib/payload';

/**
 * How far the candidate is willing to go, as the form asks it: a nationwide
 * answer and a radius are exclusive, and only the second one carries a number.
 * The API stores the pair (`mobilityNationwide`, `mobilityRadiusKm`), which
 * `buildCandidateAccountPayload` derives from this single choice.
 */
export const MOBILITY_SCOPES = ['NATIONWIDE', 'RADIUS'] as const;

export type MobilityScope = (typeof MOBILITY_SCOPES)[number];

/**
 * Every field is held as a string (or `''` for an unset choice) because that is
 * what the inputs produce. Coercion to the API shape happens once, in
 * `buildCandidateAccountPayload`.
 *
 * `latitude` and `longitude` are absent on purpose: the API derives them from
 * the (city, postal code) pair and refuses them in a body, so a client cannot
 * show one commune and be matched at another.
 */
export interface CandidateAccountForm {
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

export const emptyCandidateAccountForm: CandidateAccountForm = {
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

/**
 * Declared as a type alias, not an interface: orval types `UpdateCandidateProfileDto`
 * as `{ [key: string]: unknown }`, and only an object type alias gets the implicit
 * index signature that makes it assignable to one.
 *
 * `null` is a value here, not an absence: this is a PATCH, and a column the
 * candidate has emptied has to be told to become empty. Only the choices with no
 * representable empty form are omitted instead.
 */
export type CandidateAccountPayload = {
  firstName: string;
  lastName: string;
  bio: string;
  city: string;
  postalCode: string;
  desiredJobTitle: string;
  contractTypes: ContractType[];
  experienceLevel?: ExperienceLevel;
  availability?: Availability;
  availabilityDelayMonths: number | null;
  availabilityDate?: string;
  remotePolicy?: RemotePolicy;
  mobilityNationwide?: boolean;
  mobilityRadiusKm: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
  languages: string[];
  linkedinUrl: string;
};

const numberText = (value: number | null): string => (value === null ? '' : String(value));

const integerOrNull = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * `availability_date` is a `timestamptz`, so the API answers a full instant while
 * `<input type="date">` only ever reads and writes a calendar day.
 */
const dayOf = (value: string | null): string => (value === null ? '' : value.slice(0, 10));

const mobilityScopeOf = (profile: CandidateProfileResponseDto): MobilityScope | '' => {
  if (profile.mobilityNationwide !== null) {
    return profile.mobilityNationwide ? 'NATIONWIDE' : 'RADIUS';
  }

  // A radius without the flag: written before the flag existed, or by a client
  // that only sent the number. It still says where the candidate wants to work.
  return profile.mobilityRadiusKm === null ? '' : 'RADIUS';
};

export const toCandidateAccountForm = (
  profile: CandidateProfileResponseDto,
): CandidateAccountForm => ({
  firstName: profile.firstName,
  lastName: profile.lastName,
  city: profile.city ?? '',
  postalCode: profile.postalCode ?? '',
  desiredJobTitle: profile.desiredJobTitle ?? '',
  contractTypes: profile.contractTypes,
  experienceLevel: profile.experienceLevel ?? '',
  availability: profile.availability ?? '',
  availabilityDelayMonths: numberText(profile.availabilityDelayMonths),
  availabilityDate: dayOf(profile.availabilityDate),
  remotePolicy: profile.remotePolicy ?? '',
  mobilityScope: mobilityScopeOf(profile),
  mobilityRadiusKm: numberText(profile.mobilityRadiusKm),
  salaryMin: numberText(profile.salaryMin),
  salaryMax: numberText(profile.salaryMax),
  skills: profile.skills,
  languages: profile.languages,
  bio: profile.bio ?? '',
  linkedinUrl: profile.linkedinUrl ?? '',
});

/**
 * The delay and the date belong to one answer each, so only the one matching the
 * chosen availability is meaningful. The unused number is cleared rather than
 * left behind, which the date cannot be: `availabilityDate` carries a
 * `@Type(() => Date)` transform server-side, and what it makes of an explicit
 * `null` is not a contract this client can verify — so it is omitted instead, and
 * a date the candidate has moved away from stays in the column, unread.
 */
const availabilityDelay = (form: CandidateAccountForm): number | null =>
  form.availability === 'WITHIN_DELAY' ? integerOrNull(form.availabilityDelayMonths) : null;

const availabilityDate = (form: CandidateAccountForm): string | undefined =>
  form.availability === 'SPECIFIC_DATE' ? form.availabilityDate.trim() || undefined : undefined;

export const buildCandidateAccountPayload = (form: CandidateAccountForm): CandidateAccountPayload =>
  withoutEmptyFields({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    bio: form.bio.trim(),
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    desiredJobTitle: form.desiredJobTitle.trim(),
    contractTypes: form.contractTypes,
    experienceLevel: form.experienceLevel || undefined,
    availability: form.availability || undefined,
    availabilityDelayMonths: availabilityDelay(form),
    availabilityDate: availabilityDate(form),
    remotePolicy: form.remotePolicy || undefined,
    mobilityNationwide: form.mobilityScope === '' ? undefined : form.mobilityScope === 'NATIONWIDE',
    mobilityRadiusKm: form.mobilityScope === 'RADIUS' ? integerOrNull(form.mobilityRadiusKm) : null,
    salaryMin: integerOrNull(form.salaryMin),
    salaryMax: integerOrNull(form.salaryMax),
    // Written as one set server-side: a body carrying only one of the two clears
    // the other, so both always travel together.
    skills: form.skills,
    languages: form.languages,
    linkedinUrl: form.linkedinUrl.trim(),
  });

export type CandidateAccountField = 'firstName' | 'lastName' | 'city';

export interface CandidateAccountInvalidField {
  field: CandidateAccountField;
  message: string;
}

/**
 * A commune is mandatory even though the column is nullable: typing in the city
 * field clears the selected one, so without this a profile loses its address by
 * accident — and the API keeps the coordinates of the old commune when the pair
 * arrives empty, leaving the row half erased. Half a pair is refused too: the
 * API derives the coordinates from both and answers 400 on a lone city.
 */
export const firstInvalidCandidateField = (
  form: CandidateAccountForm,
): CandidateAccountInvalidField | null => {
  if (form.firstName.trim() === '') {
    return { field: 'firstName', message: 'Votre prénom est obligatoire.' };
  }

  if (form.lastName.trim() === '') {
    return { field: 'lastName', message: 'Votre nom est obligatoire.' };
  }

  if (form.city.trim() === '' || form.postalCode.trim() === '') {
    return { field: 'city', message: 'Choisissez votre commune dans la liste.' };
  }

  return null;
};

export const MOBILITY_SCOPE_OPTIONS = [
  { value: 'NATIONWIDE', label: 'Toute la France' },
  { value: 'RADIUS', label: 'Autour de ma ville' },
] as const satisfies readonly Option<MobilityScope>[];
