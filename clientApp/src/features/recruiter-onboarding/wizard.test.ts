import { describe, it, expect } from 'vitest';
import { RECRUITER_STEPS, validateStep } from './wizard';
import { emptyRecruiterOnboarding, type RecruiterOnboardingState } from './state';

const complete: RecruiterOnboardingState = {
  ...emptyRecruiterOnboarding,
  firstName: 'Julien',
  lastName: 'Lemaitre',
  jobTitle: 'Responsable RH',
  companyName: 'Rekr',
  sectorId: '4',
  size: 'PME',
  city: 'Lyon',
  postalCode: '69003',
  description: 'On construit le matching qui respecte les candidats.',
  offerTitle: 'Développeur Front React',
  offerCity: 'Lyon',
  offerPostalCode: '69003',
  offerDescription: 'Construire les écrans du swipe.',
  skills: ['React'],
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
};

describe('RECRUITER_STEPS', () => {
  it('décrit les 5 étapes du parcours recruteur', () => {
    expect(RECRUITER_STEPS).toHaveLength(5);
    expect(RECRUITER_STEPS.map((step) => step.id)).toEqual([
      'identity',
      'company',
      'culture',
      'offer',
      'matching',
    ]);
  });

  it('donne un titre à chaque étape', () => {
    for (const step of RECRUITER_STEPS) {
      expect(step.title).not.toBe('');
    }
  });
});

describe('validateStep', () => {
  it('accepte chaque étape quand tout est renseigné', () => {
    for (let index = 0; index < RECRUITER_STEPS.length; index += 1) {
      expect(validateStep(index, complete)).toBeNull();
    }
  });

  // Each error names the offending field so the step can mark it, rather than
  // showing one catch-all message per step.
  it.each([
    [0, { firstName: '' }, 'firstName', 'Renseignez votre prénom.'],
    [0, { lastName: '' }, 'lastName', 'Renseignez votre nom.'],
    [0, { jobTitle: '   ' }, 'jobTitle', 'Renseignez votre poste.'],
    [1, { companyName: '' }, 'companyName', 'Renseignez le nom de votre société.'],
    [1, { sectorId: '' }, 'sectorId', 'Choisissez le secteur de votre société.'],
    [1, { size: '' as const }, 'size', 'Choisissez la taille de votre société.'],
    [1, { city: '' }, 'city', 'Renseignez la ville de votre société.'],
    [1, { postalCode: '' }, 'postalCode', 'Renseignez le code postal de votre société.'],
    [
      2,
      { description: '' },
      'description',
      'Présentez votre société pour donner envie aux candidats.',
    ],
    [3, { offerTitle: '' }, 'offerTitle', 'Renseignez le titre du poste.'],
    [3, { offerDescription: '' }, 'offerDescription', 'Décrivez les missions du poste.'],
    [3, { skills: [] }, 'skills', 'Ajoutez au moins une compétence recherchée.'],
    [3, { offerCity: '' }, 'offerCity', 'Renseignez la ville du poste.'],
    [3, { offerPostalCode: '' }, 'offerPostalCode', 'Renseignez le code postal du poste.'],
    [4, { contractType: '' as const }, 'contractType', 'Choisissez le type de contrat.'],
    [
      4,
      { minExperienceLevel: '' as const },
      'minExperienceLevel',
      'Choisissez l’expérience requise.',
    ],
    [4, { remotePolicy: '' as const }, 'remotePolicy', 'Choisissez la politique de télétravail.'],
    [
      4,
      { salaryMin: '55000', salaryMax: '45000' },
      'salaryMax',
      'Le salaire maximum ne peut pas être inférieur au minimum.',
    ],
  ])('étape %i — %o désigne le champ %s', (index, patch, field, message) => {
    expect(validateStep(index as number, { ...complete, ...patch })).toEqual({ field, message });
  });

  it('signale le premier champ manquant dans l’ordre du formulaire', () => {
    expect(validateStep(0, emptyRecruiterOnboarding)).toEqual({
      field: 'firstName',
      message: 'Renseignez votre prénom.',
    });
  });

  it('accepte une fourchette de salaire cohérente ou partiellement remplie', () => {
    expect(validateStep(4, { ...complete, salaryMin: '45000', salaryMax: '55000' })).toBeNull();
    expect(validateStep(4, { ...complete, salaryMin: '45000', salaryMax: '' })).toBeNull();
    expect(validateStep(4, { ...complete, salaryMin: '45000', salaryMax: '45000' })).toBeNull();
  });
});
