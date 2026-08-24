import type { Option } from '@/components/form/OptionCards';
import type {
  Availability,
  CompanySize,
  ContractType,
  ExperienceLevel,
  RemotePolicy,
} from './enums';

export const COMPANY_SIZE_OPTIONS = [
  { value: 'TPE', label: 'TPE' },
  { value: 'PME', label: 'PME' },
] as const satisfies readonly Option<CompanySize>[];

export const CONTRACT_TYPE_OPTIONS = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'ALTERNANCE', label: 'Alternance' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'INTERIM', label: 'Intérim' },
] as const satisfies readonly Option<ContractType>[];

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'CONFIRME', label: 'Confirmé' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'EXPERT', label: 'Expert' },
] as const satisfies readonly Option<ExperienceLevel>[];

export const REMOTE_POLICY_OPTIONS = [
  { value: 'ON_SITE', label: 'Sur site' },
  { value: 'HYBRID', label: 'Hybride' },
  { value: 'FULL_REMOTE', label: 'Full remote' },
] as const satisfies readonly Option<RemotePolicy>[];

export const AVAILABILITY_OPTIONS = [
  { value: 'IMMEDIATE', label: 'Immédiate' },
  { value: 'WITHIN_DELAY', label: 'Sous quelques mois' },
  { value: 'SPECIFIC_DATE', label: 'À une date précise' },
] as const satisfies readonly Option<Availability>[];
