import { describe, it, expect } from 'vitest';
import { CANDIDATE_STEPS, validateStep } from './wizard';
import { emptyCandidateOnboarding, type CandidateOnboardingState } from './state';

const complete: CandidateOnboardingState = {
  ...emptyCandidateOnboarding,
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'Lyon',
  postalCode: '69003',
  desiredJobTitle: 'Développeuse Front React',
  contractTypes: ['CDI'],
  experienceLevel: 'CONFIRME',
  availability: 'IMMEDIATE',
  remotePolicy: 'HYBRID',
  mobilityScope: 'NATIONWIDE',
  skills: ['React'],
  bio: 'Pionnière du calcul.',
};

describe('CANDIDATE_STEPS', () => {
  it('décrit les 4 étapes du parcours candidat', () => {
    expect(CANDIDATE_STEPS).toHaveLength(4);
    expect(CANDIDATE_STEPS.map((step) => step.id)).toEqual([
      'identity',
      'project',
      'preferences',
      'showcase',
    ]);
  });

  it('donne un titre à chaque étape', () => {
    for (const step of CANDIDATE_STEPS) {
      expect(step.title).not.toBe('');
    }
  });
});

describe('validateStep', () => {
  it('accepte chaque étape quand tout est renseigné', () => {
    for (let index = 0; index < CANDIDATE_STEPS.length; index += 1) {
      expect(validateStep(index, complete)).toBeNull();
    }
  });

  it.each([
    [0, { firstName: '' }, 'firstName', 'Renseignez votre prénom.'],
    [0, { lastName: '  ' }, 'lastName', 'Renseignez votre nom.'],
    [0, { city: '' }, 'city', 'Choisissez votre commune dans la liste.'],
    // Both halves are written by the same selection, so a lone postcode can
    // only come from a hand-edited draft — and it is still not a location.
    [0, { postalCode: '' }, 'city', 'Choisissez votre commune dans la liste.'],
    [1, { desiredJobTitle: '' }, 'desiredJobTitle', 'Renseignez le poste que vous recherchez.'],
    [1, { contractTypes: [] }, 'contractTypes', 'Choisissez au moins un type de contrat.'],
    [
      1,
      { experienceLevel: '' as const },
      'experienceLevel',
      'Choisissez votre niveau d’expérience.',
    ],
    [1, { availability: '' as const }, 'availability', 'Indiquez votre disponibilité.'],
    [
      2,
      { remotePolicy: '' as const },
      'remotePolicy',
      'Choisissez votre préférence de télétravail.',
    ],
    [
      2,
      { mobilityScope: '' as const },
      'mobilityScope',
      'Indiquez jusqu’où vous pouvez vous déplacer.',
    ],
    [3, { skills: [] }, 'skills', 'Ajoutez au moins une compétence.'],
    [3, { bio: '' }, 'bio', 'Présentez-vous pour donner envie aux recruteurs.'],
  ])('refuse l’étape %i quand %o manque', (index, patch, field, message) => {
    expect(validateStep(index, { ...complete, ...patch })).toEqual({ field, message });
  });

  // The companion field only exists for one of the three answers, so it is
  // required exactly when that answer is selected — and ignored otherwise.
  it('exige un délai quand la disponibilité est « sous délai »', () => {
    expect(
      validateStep(1, { ...complete, availability: 'WITHIN_DELAY', availabilityDelayMonths: '' }),
    ).toEqual({
      field: 'availabilityDelayMonths',
      message: 'Indiquez sous combien de mois vous êtes disponible.',
    });

    expect(
      validateStep(1, { ...complete, availability: 'WITHIN_DELAY', availabilityDelayMonths: '3' }),
    ).toBeNull();
  });

  it('exige une date quand la disponibilité est « à une date précise »', () => {
    expect(
      validateStep(1, { ...complete, availability: 'SPECIFIC_DATE', availabilityDate: '' }),
    ).toEqual({
      field: 'availabilityDate',
      message: 'Choisissez votre date de disponibilité.',
    });

    expect(
      validateStep(1, {
        ...complete,
        availability: 'SPECIFIC_DATE',
        availabilityDate: '2026-09-01',
      }),
    ).toBeNull();
  });

  it('exige un rayon quand la mobilité est limitée à une distance', () => {
    expect(validateStep(2, { ...complete, mobilityScope: 'RADIUS', mobilityRadiusKm: '' })).toEqual(
      {
        field: 'mobilityRadiusKm',
        message: 'Indiquez votre rayon de mobilité en kilomètres.',
      },
    );

    expect(
      validateStep(2, { ...complete, mobilityScope: 'RADIUS', mobilityRadiusKm: '30' }),
    ).toBeNull();
  });

  it('refuse une fourchette de salaire décroissante', () => {
    expect(validateStep(2, { ...complete, salaryMin: '55000', salaryMax: '45000' })).toEqual({
      field: 'salaryMax',
      message: 'Le salaire maximum ne peut pas être inférieur au minimum.',
    });
  });

  // Salary is optional: only a pair given in the wrong order is an error.
  it('accepte une fourchette de salaire partielle ou absente', () => {
    expect(validateStep(2, { ...complete, salaryMin: '45000', salaryMax: '' })).toBeNull();
    expect(validateStep(2, { ...complete, salaryMin: '', salaryMax: '' })).toBeNull();
  });

  it('ne valide rien au-delà de la dernière étape', () => {
    expect(validateStep(CANDIDATE_STEPS.length, emptyCandidateOnboarding)).toBeNull();
  });
});
