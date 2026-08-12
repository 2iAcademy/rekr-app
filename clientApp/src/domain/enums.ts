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
export const AVAILABILITIES = ['IMMEDIATE', 'WITHIN_DELAY', 'SPECIFIC_DATE'] as const;

export type CompanySize = (typeof COMPANY_SIZES)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type RemotePolicy = (typeof REMOTE_POLICIES)[number];
export type Availability = (typeof AVAILABILITIES)[number];
