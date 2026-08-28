import { describe, it, expect } from 'vitest';
import { buildCompanyPayload, buildOfferPayload } from './payload';
import { emptyRecruiterOnboarding, type RecruiterOnboardingState } from './state';

const filled: RecruiterOnboardingState = {
  firstName: 'Julien',
  lastName: 'Lemaitre',
  jobTitle: 'Responsable RH',
  companyName: 'Rekr',
  sectorId: '4',
  size: 'PME',
  city: 'Lyon',
  postalCode: '69003',
  siteUrl: 'https://rekr.fr',
  description: 'On construit le matching qui respecte les candidats.',
  benefits: ['Mutuelle', 'Tickets resto'],
  offerTitle: 'Développeur Front React',
  offerCity: 'Lyon',
  offerPostalCode: '69003',
  offerDescription: 'Construire les écrans du swipe.',
  skills: ['React', 'TypeScript'],
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
  salaryMin: '45000',
  salaryMax: '55000',
};

describe('buildCompanyPayload', () => {
  it('mappe identité et société vers les champs attendus par l’API', () => {
    expect(buildCompanyPayload(filled)).toEqual({
      firstName: 'Julien',
      lastName: 'Lemaitre',
      jobTitle: 'Responsable RH',
      name: 'Rekr',
      sectorId: 4,
      size: 'PME',
      city: 'Lyon',
      postalCode: '69003',
      siteUrl: 'https://rekr.fr',
      description: 'On construit le matching qui respecte les candidats.',
    });
  });

  it('omet les champs optionnels laissés vides plutôt que d’envoyer une chaîne vide', () => {
    const payload = buildCompanyPayload({
      ...emptyRecruiterOnboarding,
      firstName: 'Julien',
      lastName: 'Lemaitre',
      companyName: 'Rekr',
    });

    expect(payload).toEqual({
      firstName: 'Julien',
      lastName: 'Lemaitre',
      name: 'Rekr',
    });
  });

  it('supprime les espaces superflus autour des valeurs saisies', () => {
    const payload = buildCompanyPayload({
      ...emptyRecruiterOnboarding,
      firstName: '  Julien  ',
      lastName: ' Lemaitre ',
      companyName: '  Rekr ',
    });

    expect(payload).toMatchObject({
      firstName: 'Julien',
      lastName: 'Lemaitre',
      name: 'Rekr',
    });
  });

  // Les avantages partent avec l'offre : les laisser ici les rattacherait à la
  // société, où le recruteur ne peut plus les éditer.
  it('n’envoie pas les avantages avec la société', () => {
    expect(buildCompanyPayload(filled)).not.toHaveProperty('benefits');
  });
});

describe('buildOfferPayload', () => {
  it('mappe la première offre et la publie', () => {
    expect(buildOfferPayload(filled)).toEqual({
      title: 'Développeur Front React',
      description: 'Construire les écrans du swipe.',
      city: 'Lyon',
      postalCode: '69003',
      skills: ['React', 'TypeScript'],
      benefits: ['Mutuelle', 'Tickets resto'],
      contractType: 'CDI',
      minExperienceLevel: 'CONFIRME',
      remotePolicy: 'HYBRID',
      salaryMin: 45000,
      salaryMax: 55000,
      status: 'open',
    });
  });

  it('omet les avantages quand aucun n’a été ajouté', () => {
    const payload = buildOfferPayload({ ...filled, benefits: [] });

    expect(payload).not.toHaveProperty('benefits');
  });

  it('convertit les salaires en entiers et omet ceux laissés vides', () => {
    const payload = buildOfferPayload({ ...filled, salaryMin: '45000', salaryMax: '' });

    expect(payload).toMatchObject({ salaryMin: 45000 });
    expect(payload).not.toHaveProperty('salaryMax');
  });

  it('omet les champs optionnels laissés vides', () => {
    const payload = buildOfferPayload({
      ...emptyRecruiterOnboarding,
      offerTitle: 'Développeur Front React',
    });

    expect(payload).toEqual({
      title: 'Développeur Front React',
      status: 'open',
    });
  });
});
