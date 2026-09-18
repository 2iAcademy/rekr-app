import { contractLabel, metaLine, offerSalaryLabel } from '@/components/feed/labels';
import {
  AVAILABILITY_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  REMOTE_POLICY_OPTIONS,
} from '@/domain/options';
import type { CandidateAccountForm } from './candidateAccountForm';

/**
 * What each folded section of the candidate profile shows about itself.
 *
 * A header that only names its section forces the reader to unfold all four to
 * find the one they came for, and says nothing about what is already filled in.
 * These lines are that answer — the same wording the rest of the product uses,
 * read from the shared option lists rather than restated here.
 *
 * An empty string means « nothing filled in yet », which the header words on its
 * own.
 */
const labelOf = <T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | '',
): string | null =>
  value === '' ? null : (options.find((option) => option.value === value)?.label ?? null);

const count = (label: string, plural: string, items: readonly unknown[]): string | null => {
  if (items.length === 0) {
    return null;
  }

  return items.length === 1 ? `1 ${label}` : `${items.length} ${plural}`;
};

/**
 * `offerSalaryLabel` answers « Salaire non communiqué » on two empty bounds,
 * which is a sentence for a card, not a fragment for a summary line — here the
 * line simply drops.
 */
const salaryRange = (min: string, max: string): string | null => {
  const figure = (value: string): number | null => {
    const parsed = Number(value.trim());

    return value.trim() === '' || Number.isNaN(parsed) ? null : parsed;
  };

  const low = figure(min);
  const high = figure(max);

  return low === null && high === null ? null : offerSalaryLabel(low, high);
};

export interface CandidateSummaries {
  identity: string;
  project: string;
  preferences: string;
  showcase: string;
}

export const candidateSummaries = (form: CandidateAccountForm): CandidateSummaries => ({
  identity: metaLine([
    `${form.firstName} ${form.lastName}`.trim() || null,
    form.city.trim() || null,
  ]),

  project: metaLine([
    form.desiredJobTitle.trim() || null,
    form.contractTypes.length === 0 ? null : form.contractTypes.map(contractLabel).join(', '),
    labelOf(EXPERIENCE_LEVEL_OPTIONS, form.experienceLevel),
  ]),

  preferences: metaLine([
    labelOf(REMOTE_POLICY_OPTIONS, form.remotePolicy),
    labelOf(AVAILABILITY_OPTIONS, form.availability),
    // Same wording as an offer's salary — « 42 - 48 k€ », not the raw figures:
    // the candidate reads their own expectation in the unit the product uses
    // everywhere else. Null when neither bound is given, so the line drops
    // instead of announcing a range nobody named.
    salaryRange(form.salaryMin, form.salaryMax),
  ]),

  showcase: metaLine([
    count('compétence', 'compétences', form.skills),
    count('langue', 'langues', form.languages),
    form.bio.trim() === '' ? null : 'présentation',
  ]),
});
