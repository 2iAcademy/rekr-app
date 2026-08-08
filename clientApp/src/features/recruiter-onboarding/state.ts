// Mirrors the `CompanySize` enum, narrowed to Rekr's target: small and
// mid-sized service companies.
export const COMPANY_SIZES = ['TPE', 'PME'] as const;
export const CONTRACT_TYPES = [
  'CDI',
  'CDD',
  'ALTERNANCE',
  'STAGE',
  'FREELANCE',
  'INTERIM',
] as const;
export const EXPERIENCE_LEVELS = ['JUNIOR', 'CONFIRME', 'SENIOR', 'EXPERT'] as const;
export const REMOTE_POLICIES = ['ON_SITE', 'HYBRID', 'FULL_REMOTE'] as const;

export type CompanySize = (typeof COMPANY_SIZES)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type RemotePolicy = (typeof REMOTE_POLICIES)[number];

/**
 * Every field is held as a string (or `''` for an unset enum) because that is
 * what the inputs produce. Coercion to the API shape happens once, in
 * `buildCompanyPayload` / `buildOfferPayload`.
 */
export interface RecruiterOnboardingState {
  firstName: string;
  lastName: string;
  jobTitle: string;
  companyName: string;
  sectorId: string;
  size: CompanySize | '';
  city: string;
  postalCode: string;
  siteUrl: string;
  description: string;
  benefits: string[];
  offerTitle: string;
  offerCity: string;
  offerPostalCode: string;
  offerDescription: string;
  skills: string[];
  contractType: ContractType | '';
  minExperienceLevel: ExperienceLevel | '';
  remotePolicy: RemotePolicy | '';
  salaryMin: string;
  salaryMax: string;
}

export const emptyRecruiterOnboarding: RecruiterOnboardingState = {
  firstName: '',
  lastName: '',
  jobTitle: '',
  companyName: '',
  sectorId: '',
  size: '',
  city: '',
  postalCode: '',
  siteUrl: '',
  description: '',
  benefits: [],
  offerTitle: '',
  offerCity: '',
  offerPostalCode: '',
  offerDescription: '',
  skills: [],
  contractType: '',
  minExperienceLevel: '',
  remotePolicy: '',
  salaryMin: '',
  salaryMax: '',
};
