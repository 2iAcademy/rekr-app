import { describe, it, expect } from 'vitest';
import { buildCandidateProfilePayload } from './payload';
import { emptyCandidateOnboarding, type CandidateOnboardingState } from './state';

const filled: CandidateOnboardingState = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'Lyon',
  postalCode: '69003',
  desiredJobTitle: 'Développeuse Front React',
  contractTypes: ['CDI', 'FREELANCE'],
  experienceLevel: 'CONFIRME',
  availability: 'IMMEDIATE',
  availabilityDelayMonths: '',
  availabilityDate: '',
  remotePolicy: 'HYBRID',
  mobilityScope: 'RADIUS',
  mobilityRadiusKm: '30',
  salaryMin: '45000',
  salaryMax: '55000',
  skills: ['React', 'TypeScript'],
  languages: ['Anglais'],
  bio: 'Pionnière du calcul.',
  linkedinUrl: 'https://linkedin.com/in/ada',
};

describe('buildCandidateProfilePayload', () => {
  it('mappe le profil vers les champs attendus par l’API', () => {
    expect(buildCandidateProfilePayload(filled)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'Lyon',
      postalCode: '69003',
      desiredJobTitle: 'Développeuse Front React',
      contractTypes: ['CDI', 'FREELANCE'],
      experienceLevel: 'CONFIRME',
      availability: 'IMMEDIATE',
      remotePolicy: 'HYBRID',
      mobilityNationwide: false,
      mobilityRadiusKm: 30,
      salaryMin: 45000,
      salaryMax: 55000,
      skills: ['React', 'TypeScript'],
      languages: ['Anglais'],
      bio: 'Pionnière du calcul.',
      linkedinUrl: 'https://linkedin.com/in/ada',
    });
  });

  it('omet les champs optionnels laissés vides plutôt que d’envoyer une chaîne vide', () => {
    const payload = buildCandidateProfilePayload({
      ...emptyCandidateOnboarding,
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(payload).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('supprime les espaces superflus autour des valeurs saisies', () => {
    const payload = buildCandidateProfilePayload({
      ...emptyCandidateOnboarding,
      firstName: '  Ada ',
      lastName: ' Lovelace  ',
      city: ' Lyon ',
    });

    expect(payload).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', city: 'Lyon' });
  });

  it('traduit une mobilité nationale sans rayon', () => {
    const payload = buildCandidateProfilePayload({
      ...filled,
      mobilityScope: 'NATIONWIDE',
      mobilityRadiusKm: '30',
    });

    expect(payload).toMatchObject({ mobilityNationwide: true });
    expect(payload).not.toHaveProperty('mobilityRadiusKm');
  });

  it('n’envoie aucune mobilité tant que le candidat n’a pas répondu', () => {
    const payload = buildCandidateProfilePayload({ ...filled, mobilityScope: '' });

    expect(payload).not.toHaveProperty('mobilityNationwide');
    expect(payload).not.toHaveProperty('mobilityRadiusKm');
  });

  // The three availabilities carry different companion fields; sending the one
  // that belongs to another answer would store a delay the candidate replaced
  // by a date, or the other way round.
  it('n’envoie le délai qu’avec une disponibilité sous délai', () => {
    const payload = buildCandidateProfilePayload({
      ...filled,
      availability: 'WITHIN_DELAY',
      availabilityDelayMonths: '3',
      availabilityDate: '2026-09-01',
    });

    expect(payload).toMatchObject({ availability: 'WITHIN_DELAY', availabilityDelayMonths: 3 });
    expect(payload).not.toHaveProperty('availabilityDate');
  });

  it('n’envoie la date qu’avec une disponibilité à date précise', () => {
    const payload = buildCandidateProfilePayload({
      ...filled,
      availability: 'SPECIFIC_DATE',
      availabilityDelayMonths: '3',
      availabilityDate: '2026-09-01',
    });

    expect(payload).toMatchObject({
      availability: 'SPECIFIC_DATE',
      availabilityDate: '2026-09-01',
    });
    expect(payload).not.toHaveProperty('availabilityDelayMonths');
  });

  // L'API dérive les coordonnées du couple (commune, code postal) qu'elle vient
  // de valider. Les envoyer permettrait d'afficher une commune et d'être
  // géolocalisé ailleurs.
  it('n’envoie jamais de coordonnées', () => {
    const payload = buildCandidateProfilePayload(filled);

    expect(payload).not.toHaveProperty('latitude');
    expect(payload).not.toHaveProperty('longitude');
  });

  it('convertit les salaires en entiers et omet celui laissé vide', () => {
    const payload = buildCandidateProfilePayload({ ...filled, salaryMax: '' });

    expect(payload).toMatchObject({ salaryMin: 45000 });
    expect(payload).not.toHaveProperty('salaryMax');
  });

  it('omet les listes vides', () => {
    const payload = buildCandidateProfilePayload({
      ...filled,
      contractTypes: [],
      skills: [],
      languages: [],
    });

    expect(payload).not.toHaveProperty('contractTypes');
    expect(payload).not.toHaveProperty('skills');
    expect(payload).not.toHaveProperty('languages');
  });
});
