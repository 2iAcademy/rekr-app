import type { CompanySize, ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';

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
  // Written by the city field along with the pair above, never typed.
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
