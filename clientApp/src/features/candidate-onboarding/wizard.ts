import type { CandidateOnboardingState } from './state';

export const CANDIDATE_STEPS = [
  { id: 'identity', title: 'Mon identité' },
  { id: 'project', title: 'Mon projet' },
  { id: 'preferences', title: 'Préférences & mobilité' },
  { id: 'showcase', title: 'Compétences & vitrine' },
] as const;

export type CandidateStepId = (typeof CANDIDATE_STEPS)[number]['id'];

export type CandidateField = keyof CandidateOnboardingState;

export interface StepError {
  field: CandidateField;
  message: string;
}

interface Rule {
  field: CandidateField;
  message: string;
  isSatisfied: (state: CandidateOnboardingState) => boolean;
}

const filled =
  (field: CandidateField) =>
  (state: CandidateOnboardingState): boolean =>
    String(state[field]).trim() !== '';

const chosen =
  (field: CandidateField) =>
  (state: CandidateOnboardingState): boolean =>
    state[field] !== '';

const salaryRangeIsOrdered = (state: CandidateOnboardingState): boolean => {
  const min = Number.parseInt(state.salaryMin, 10);
  const max = Number.parseInt(state.salaryMax, 10);

  return Number.isNaN(min) || Number.isNaN(max) || max >= min;
};

/**
 * Ordered per step: the first unsatisfied rule wins, so the reported field is
 * the one the candidate reaches first going down the form.
 */
const RULES: Record<CandidateStepId, Rule[]> = {
  identity: [
    { field: 'firstName', message: 'Renseignez votre prénom.', isSatisfied: filled('firstName') },
    { field: 'lastName', message: 'Renseignez votre nom.', isSatisfied: filled('lastName') },
    {
      field: 'city',
      message: 'Choisissez votre commune dans la liste.',
      // `CityField` writes the name and the postcode together and clears them
      // together, so a half-filled pair means the field was edited after a
      // selection — or the draft was tampered with.
      isSatisfied: (state) => filled('city')(state) && filled('postalCode')(state),
    },
  ],
  project: [
    {
      field: 'desiredJobTitle',
      message: 'Renseignez le poste que vous recherchez.',
      isSatisfied: filled('desiredJobTitle'),
    },
    {
      field: 'contractTypes',
      message: 'Choisissez au moins un type de contrat.',
      isSatisfied: (state) => state.contractTypes.length > 0,
    },
    {
      field: 'experienceLevel',
      message: 'Choisissez votre niveau d’expérience.',
      isSatisfied: chosen('experienceLevel'),
    },
    {
      field: 'availability',
      message: 'Indiquez votre disponibilité.',
      isSatisfied: chosen('availability'),
    },
    {
      field: 'availabilityDelayMonths',
      message: 'Indiquez sous combien de mois vous êtes disponible.',
      isSatisfied: (state) =>
        state.availability !== 'WITHIN_DELAY' || filled('availabilityDelayMonths')(state),
    },
    {
      field: 'availabilityDate',
      message: 'Choisissez votre date de disponibilité.',
      isSatisfied: (state) =>
        state.availability !== 'SPECIFIC_DATE' || filled('availabilityDate')(state),
    },
  ],
  preferences: [
    {
      field: 'remotePolicy',
      message: 'Choisissez votre préférence de télétravail.',
      isSatisfied: chosen('remotePolicy'),
    },
    {
      field: 'mobilityScope',
      message: 'Indiquez jusqu’où vous pouvez vous déplacer.',
      isSatisfied: chosen('mobilityScope'),
    },
    {
      field: 'mobilityRadiusKm',
      message: 'Indiquez votre rayon de mobilité en kilomètres.',
      isSatisfied: (state) => state.mobilityScope !== 'RADIUS' || filled('mobilityRadiusKm')(state),
    },
    {
      field: 'salaryMax',
      message: 'Le salaire maximum ne peut pas être inférieur au minimum.',
      isSatisfied: salaryRangeIsOrdered,
    },
  ],
  showcase: [
    {
      field: 'skills',
      message: 'Ajoutez au moins une compétence.',
      isSatisfied: (state) => state.skills.length > 0,
    },
    {
      field: 'bio',
      message: 'Présentez-vous pour donner envie aux recruteurs.',
      isSatisfied: filled('bio'),
    },
  ],
};

export const validateStep = (index: number, state: CandidateOnboardingState): StepError | null => {
  const step = CANDIDATE_STEPS[index];
  if (!step) {
    return null;
  }

  const broken = RULES[step.id].find((rule) => !rule.isSatisfied(state));

  return broken ? { field: broken.field, message: broken.message } : null;
};
