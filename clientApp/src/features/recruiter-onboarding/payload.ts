import type {
  CompanySize,
  ContractType,
  ExperienceLevel,
  RecruiterOnboardingState,
  RemotePolicy,
} from './state';

/**
 * Declared as type aliases, not interfaces: orval types the generated DTOs as
 * `{ [key: string]: unknown }` (the Nest DTOs carry no `@ApiProperty`), and only
 * an object type alias gets the implicit index signature that makes it
 * assignable to one.
 */
export type CompanyPayload = {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  name: string;
  sectorId?: number;
  size?: CompanySize;
  city?: string;
  postalCode?: string;
  siteUrl?: string;
  description?: string;
  benefits?: string[];
};

export type OfferPayload = {
  title: string;
  description?: string;
  city?: string;
  postalCode?: string;
  skills?: string[];
  contractType?: ContractType;
  minExperienceLevel?: ExperienceLevel;
  remotePolicy?: RemotePolicy;
  salaryMin?: number;
  salaryMax?: number;
  status: 'open';
};

/**
 * The backend DTOs mark optional fields `@IsOptional()`, which skips validation
 * on `undefined` only — an empty string is still validated, and `siteUrl: ''`
 * would fail `@IsUrl`. So unset fields have to be absent from the body, not
 * present-and-empty.
 */
const withoutEmptyFields = <T extends object>(source: T): T =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined)) as T;

const optionalText = (value: string): string | undefined => value.trim() || undefined;

const optionalList = (values: string[]): string[] | undefined =>
  values.length > 0 ? values : undefined;

const optionalInteger = (value: string): number | undefined => {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? undefined : parsed;
};

const optionalEnum = <T extends string>(value: T | ''): T | undefined => value || undefined;

export const buildCompanyPayload = (state: RecruiterOnboardingState): CompanyPayload =>
  withoutEmptyFields({
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    jobTitle: optionalText(state.jobTitle),
    name: state.companyName.trim(),
    sectorId: optionalInteger(state.sectorId),
    size: optionalEnum(state.size),
    city: optionalText(state.city),
    postalCode: optionalText(state.postalCode),
    siteUrl: optionalText(state.siteUrl),
    description: optionalText(state.description),
    benefits: optionalList(state.benefits),
  });

export const buildOfferPayload = (state: RecruiterOnboardingState): OfferPayload =>
  withoutEmptyFields({
    title: state.offerTitle.trim(),
    description: optionalText(state.offerDescription),
    city: optionalText(state.offerCity),
    postalCode: optionalText(state.offerPostalCode),
    skills: optionalList(state.skills),
    contractType: optionalEnum(state.contractType),
    minExperienceLevel: optionalEnum(state.minExperienceLevel),
    remotePolicy: optionalEnum(state.remotePolicy),
    salaryMin: optionalInteger(state.salaryMin),
    salaryMax: optionalInteger(state.salaryMax),
    status: 'open',
  });
