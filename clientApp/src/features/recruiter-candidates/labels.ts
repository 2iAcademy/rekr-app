import type { Availability, ExperienceLevel, RemotePolicy } from '@/domain/enums';
import {
  AVAILABILITY_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  REMOTE_POLICY_OPTIONS,
} from '@/domain/options';

export { contractLabel, metaLine } from '@/components/feed/labels';

// Read from the shared option lists so a wording fixed for the forms is fixed
// here too, instead of drifting into a second vocabulary on this screen.
const labelOf = <T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string => options.find((option) => option.value === value)?.label ?? value;

/**
 * Every label below takes a nullable value and answers `null` on it, so the
 * caller drops the line rather than asserting something the candidate never
 * filled in. The showcase projection a recruiter reads is sparse by design:
 * only the first name is guaranteed.
 */
export const experienceLabel = (level: ExperienceLevel | null): string | null =>
  level === null ? null : labelOf(EXPERIENCE_LEVEL_OPTIONS, level);

export const remoteLabel = (policy: RemotePolicy | null): string | null =>
  policy === null ? null : labelOf(REMOTE_POLICY_OPTIONS, policy);

export const availabilityLabel = (availability: Availability | null): string | null =>
  availability === null ? null : labelOf(AVAILABILITY_OPTIONS, availability);
