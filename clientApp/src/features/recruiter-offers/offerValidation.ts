import type { OfferFormValue } from './offerPayload';

export type OfferField =
  | 'title'
  | 'description'
  | 'skills'
  | 'city'
  | 'contractType'
  | 'minExperienceLevel'
  | 'remotePolicy'
  | 'salaryMax';

export interface OfferFormError {
  field: OfferField;
  message: string;
}

interface Rule {
  field: OfferField;
  message: string;
  isSatisfied: (value: OfferFormValue) => boolean;
}

const filled =
  (field: 'title' | 'description' | 'city' | 'postalCode') =>
  (value: OfferFormValue): boolean =>
    value[field].trim() !== '';

const chosen =
  (field: 'contractType' | 'minExperienceLevel' | 'remotePolicy') =>
  (value: OfferFormValue): boolean =>
    value[field] !== '';

/**
 * Restated rather than imported from `recruiter-onboarding/wizard.ts`: the rule
 * lives there as a module-private helper of a table keyed by wizard step, and
 * neither the helper nor the table describes an offer outside that wizard. The
 * wording below is what must not drift — the same refusal has to read the same
 * way whichever screen the recruiter is on.
 */
const salaryRangeIsOrdered = (value: OfferFormValue): boolean => {
  const min = Number.parseInt(value.salaryMin, 10);
  const max = Number.parseInt(value.salaryMax, 10);

  return Number.isNaN(min) || Number.isNaN(max) || max >= min;
};

/**
 * Ordered as the form reads: the first unsatisfied rule wins, so the field
 * reported is the one the recruiter reaches first going down the page.
 *
 * `status` carries no rule: it is typed as an `OfferStatus` and the selector
 * always holds one of the five, so there is no unset state to refuse.
 */
const RULES: readonly Rule[] = [
  {
    field: 'title',
    message: 'Renseignez le titre du poste.',
    isSatisfied: filled('title'),
  },
  {
    field: 'description',
    message: 'Décrivez les missions du poste.',
    isSatisfied: filled('description'),
  },
  {
    field: 'skills',
    message: 'Ajoutez au moins une compétence recherchée.',
    isSatisfied: (value) => value.skills.length > 0,
  },
  {
    field: 'city',
    message: 'Choisissez la commune du poste dans la liste.',
    // `CityField` writes the name and the postcode together and clears them
    // together, so a half-filled pair means the field was edited after a
    // selection — and the API refuses a lone city anyway.
    isSatisfied: (value) => filled('city')(value) && filled('postalCode')(value),
  },
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
];

export const firstOfferError = (value: OfferFormValue): OfferFormError | null => {
  const broken = RULES.find((rule) => !rule.isSatisfied(value));

  return broken ? { field: broken.field, message: broken.message } : null;
};
