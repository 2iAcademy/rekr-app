import type { Availability, ContractType, ExperienceLevel, RemotePolicy } from '@/domain/enums';

/**
 * What a recruiter reads on the profile of a candidate who applied to one of
 * their offers. A view model, not the API shape.
 *
 * `age` and `portfolioUrl` have no counterpart in the Prisma profile: both are
 * simply omitted when unknown, so the screen stays honest whether or not the
 * endpoint ends up carrying them.
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
