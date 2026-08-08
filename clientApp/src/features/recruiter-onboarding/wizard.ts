import type { RecruiterOnboardingState } from './state';

export const RECRUITER_STEPS = [
  { id: 'identity', title: 'Mon identité' },
  { id: 'company', title: 'Ma société' },
  { id: 'culture', title: 'Culture & attractivité' },
  { id: 'offer', title: 'Ma première offre' },
  { id: 'matching', title: 'Détails du poste' },
] as const;

export type RecruiterStepId = (typeof RECRUITER_STEPS)[number]['id'];

export type RecruiterField = keyof RecruiterOnboardingState;

export interface StepError {
  field: RecruiterField;
  message: string;
}

interface Rule {
  field: RecruiterField;
  message: string;
  isSatisfied: (state: RecruiterOnboardingState) => boolean;
}

const filled =
  (field: Extract<RecruiterField, string>) =>
  (state: RecruiterOnboardingState): boolean =>
    String(state[field]).trim() !== '';

const chosen =
  (field: RecruiterField) =>
  (state: RecruiterOnboardingState): boolean =>
    state[field] !== '';

const salaryRangeIsOrdered = (state: RecruiterOnboardingState): boolean => {
  const min = Number.parseInt(state.salaryMin, 10);
  const max = Number.parseInt(state.salaryMax, 10);

  return Number.isNaN(min) || Number.isNaN(max) || max >= min;
};

/**
 * Ordered per step: the first unsatisfied rule wins, so the reported field is
 * the one the recruiter reaches first going down the form.
 */
const RULES: Record<RecruiterStepId, Rule[]> = {
  identity: [
    { field: 'firstName', message: 'Renseignez votre prénom.', isSatisfied: filled('firstName') },
    { field: 'lastName', message: 'Renseignez votre nom.', isSatisfied: filled('lastName') },
    { field: 'jobTitle', message: 'Renseignez votre poste.', isSatisfied: filled('jobTitle') },
  ],
  company: [
    {
      field: 'companyName',
      message: 'Renseignez le nom de votre société.',
      isSatisfied: filled('companyName'),
    },
    {
      field: 'sectorId',
      message: 'Choisissez le secteur de votre société.',
      isSatisfied: chosen('sectorId'),
    },
    {
      field: 'size',
      message: 'Choisissez la taille de votre société.',
      isSatisfied: chosen('size'),
    },
    {
      field: 'city',
      message: 'Renseignez la ville de votre société.',
      isSatisfied: filled('city'),
    },
    {
      field: 'postalCode',
      message: 'Renseignez le code postal de votre société.',
      isSatisfied: filled('postalCode'),
    },
  ],
  culture: [
    {
      field: 'description',
      message: 'Présentez votre société pour donner envie aux candidats.',
      isSatisfied: filled('description'),
    },
  ],
  offer: [
    {
      field: 'offerTitle',
      message: 'Renseignez le titre du poste.',
      isSatisfied: filled('offerTitle'),
    },
    {
      field: 'offerDescription',
      message: 'Décrivez les missions du poste.',
      isSatisfied: filled('offerDescription'),
    },
    {
      field: 'skills',
      message: 'Ajoutez au moins une compétence recherchée.',
      isSatisfied: (state) => state.skills.length > 0,
    },
    {
      field: 'offerCity',
      message: 'Renseignez la ville du poste.',
      isSatisfied: filled('offerCity'),
    },
    {
      field: 'offerPostalCode',
      message: 'Renseignez le code postal du poste.',
      isSatisfied: filled('offerPostalCode'),
    },
  ],
  matching: [
    {
      field: 'contractType',
      message: 'Choisissez le type de contrat.',
      isSatisfied: chosen('contractType'),
    },
    {
      field: 'minExperienceLevel',
      message: 'Choisissez l’expérience requise.',
      isSatisfied: chosen('minExperienceLevel'),
    },
    {
      field: 'remotePolicy',
      message: 'Choisissez la politique de télétravail.',
      isSatisfied: chosen('remotePolicy'),
    },
    {
      field: 'salaryMax',
      message: 'Le salaire maximum ne peut pas être inférieur au minimum.',
      isSatisfied: salaryRangeIsOrdered,
    },
  ],
};

export const validateStep = (index: number, state: RecruiterOnboardingState): StepError | null => {
  const step = RECRUITER_STEPS[index];
  if (!step) {
    return null;
  }

  const broken = RULES[step.id].find((rule) => !rule.isSatisfied(state));

  return broken ? { field: broken.field, message: broken.message } : null;
};
