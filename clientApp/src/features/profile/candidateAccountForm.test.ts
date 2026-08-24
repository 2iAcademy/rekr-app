import { describe, expect, it } from 'vitest';
import type { CandidateProfileResponseDto } from '@/api/generated';
import {
  buildCandidateAccountPayload,
  emptyCandidateAccountForm,
  firstInvalidCandidateField,
  toCandidateAccountForm,
  type CandidateAccountForm,
} from './candidateAccountForm';

const profile = (
  overrides: Partial<CandidateProfileResponseDto> = {},
): CandidateProfileResponseDto => ({
  id: 7,
  userId: 42,
  firstName: 'Camille',
  lastName: 'Martin',
  picture: 'candidates/42/picture/abc.png',
  bio: 'Dix ans de front.',
  city: 'Lyon',
  postalCode: '69003',
  latitude: '45.7578137',
  longitude: '4.8320114',
  desiredJobTitle: 'Développeuse Front React',
  contractTypes: ['CDI', 'FREELANCE'],
  experienceLevel: 'SENIOR',
  availability: 'WITHIN_DELAY',
  availabilityDelayMonths: 3,
  availabilityDate: null,
  remotePolicy: 'HYBRID',
  mobilityRadiusKm: null,
  mobilityNationwide: true,
  salaryMin: 45000,
  salaryMax: 55000,
  linkedinUrl: 'https://linkedin.com/in/camille-martin',
  cvUrl: 'candidates/42/cv/def.pdf',
  skills: ['React', 'TypeScript'],
  languages: ['Anglais'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

const form = (overrides: Partial<CandidateAccountForm> = {}): CandidateAccountForm => ({
  ...emptyCandidateAccountForm,
  firstName: 'Camille',
  lastName: 'Martin',
  ...overrides,
});

describe('toCandidateAccountForm', () => {
  it('reprend les informations du profil dans les champs du formulaire', () => {
    expect(toCandidateAccountForm(profile())).toEqual({
      firstName: 'Camille',
      lastName: 'Martin',
      city: 'Lyon',
      postalCode: '69003',
      desiredJobTitle: 'Développeuse Front React',
      contractTypes: ['CDI', 'FREELANCE'],
      experienceLevel: 'SENIOR',
      availability: 'WITHIN_DELAY',
      availabilityDelayMonths: '3',
      availabilityDate: '',
      remotePolicy: 'HYBRID',
      mobilityScope: 'NATIONWIDE',
      mobilityRadiusKm: '',
      salaryMin: '45000',
      salaryMax: '55000',
      skills: ['React', 'TypeScript'],
      languages: ['Anglais'],
      bio: 'Dix ans de front.',
      linkedinUrl: 'https://linkedin.com/in/camille-martin',
    });
  });

  it('rend un champ vide pour chaque colonne nulle', () => {
    const empty = toCandidateAccountForm(
      profile({
        bio: null,
        city: null,
        postalCode: null,
        desiredJobTitle: null,
        contractTypes: [],
        experienceLevel: null,
        availability: null,
        availabilityDelayMonths: null,
        availabilityDate: null,
        remotePolicy: null,
        mobilityNationwide: null,
        mobilityRadiusKm: null,
        salaryMin: null,
        salaryMax: null,
        linkedinUrl: null,
        skills: [],
        languages: [],
      }),
    );

    expect(empty).toEqual(form({ firstName: 'Camille', lastName: 'Martin' }));
  });

  it('réduit la date de disponibilité à un jour, ce que l’input date attend', () => {
    const loaded = toCandidateAccountForm(
      profile({ availability: 'SPECIFIC_DATE', availabilityDate: '2026-09-01T00:00:00.000Z' }),
    );

    expect(loaded.availabilityDate).toBe('2026-09-01');
  });

  it('lit « autour de ma ville » d’un drapeau national explicitement faux', () => {
    const loaded = toCandidateAccountForm(
      profile({ mobilityNationwide: false, mobilityRadiusKm: 30 }),
    );

    expect(loaded.mobilityScope).toBe('RADIUS');
    expect(loaded.mobilityRadiusKm).toBe('30');
  });

  it('lit « autour de ma ville » d’un rayon seul, sans drapeau', () => {
    const loaded = toCandidateAccountForm(
      profile({ mobilityNationwide: null, mobilityRadiusKm: 30 }),
    );

    expect(loaded.mobilityScope).toBe('RADIUS');
  });

  it('ne choisit aucune mobilité quand ni le drapeau ni le rayon ne sont renseignés', () => {
    const loaded = toCandidateAccountForm(
      profile({ mobilityNationwide: null, mobilityRadiusKm: null }),
    );

    expect(loaded.mobilityScope).toBe('');
  });
});

describe('buildCandidateAccountPayload', () => {
  it('renvoie toujours les compétences et les langues ensemble', () => {
    const payload = buildCandidateAccountPayload(form({ skills: ['React'], languages: [] }));

    expect(payload).toMatchObject({ skills: ['React'], languages: [] });
  });

  it('renvoie les compétences même quand seules les langues ont changé', () => {
    const payload = buildCandidateAccountPayload(
      form({ skills: ['React'], languages: ['Anglais'] }),
    );

    expect(payload.skills).toEqual(['React']);
    expect(payload.languages).toEqual(['Anglais']);
  });

  it('envoie les champs texte vidés, pour qu’ils puissent l’être', () => {
    const payload = buildCandidateAccountPayload(
      form({ bio: '', desiredJobTitle: '', linkedinUrl: '', city: '', postalCode: '' }),
    );

    expect(payload).toMatchObject({
      bio: '',
      desiredJobTitle: '',
      linkedinUrl: '',
      city: '',
      postalCode: '',
    });
  });

  it('coupe les espaces autour des champs texte', () => {
    const payload = buildCandidateAccountPayload(
      form({ firstName: '  Camille  ', lastName: '  Martin  ', bio: '  Bonjour  ' }),
    );

    expect(payload).toMatchObject({ firstName: 'Camille', lastName: 'Martin', bio: 'Bonjour' });
  });

  it('remet les salaires à null quand les cases sont vidées', () => {
    const payload = buildCandidateAccountPayload(form({ salaryMin: '', salaryMax: '' }));

    expect(payload.salaryMin).toBeNull();
    expect(payload.salaryMax).toBeNull();
  });

  it('convertit les salaires saisis en entiers', () => {
    const payload = buildCandidateAccountPayload(form({ salaryMin: '45000', salaryMax: '55000' }));

    expect(payload).toMatchObject({ salaryMin: 45000, salaryMax: 55000 });
  });

  it('omet un choix non renseigné plutôt que d’envoyer une chaîne vide', () => {
    const payload = buildCandidateAccountPayload(
      form({ experienceLevel: '', availability: '', remotePolicy: '', mobilityScope: '' }),
    );

    expect(payload).not.toHaveProperty('experienceLevel');
    expect(payload).not.toHaveProperty('availability');
    expect(payload).not.toHaveProperty('remotePolicy');
    expect(payload).not.toHaveProperty('mobilityNationwide');
  });

  it('n’envoie le délai que pour une disponibilité à quelques mois', () => {
    const withDelay = buildCandidateAccountPayload(
      form({ availability: 'WITHIN_DELAY', availabilityDelayMonths: '3' }),
    );
    const immediate = buildCandidateAccountPayload(
      form({ availability: 'IMMEDIATE', availabilityDelayMonths: '3' }),
    );

    expect(withDelay.availabilityDelayMonths).toBe(3);
    expect(immediate.availabilityDelayMonths).toBeNull();
  });

  it('n’envoie la date que pour une disponibilité à une date précise', () => {
    const dated = buildCandidateAccountPayload(
      form({ availability: 'SPECIFIC_DATE', availabilityDate: '2026-09-01' }),
    );
    const immediate = buildCandidateAccountPayload(
      form({ availability: 'IMMEDIATE', availabilityDate: '2026-09-01' }),
    );

    expect(dated.availabilityDate).toBe('2026-09-01');
    expect(immediate).not.toHaveProperty('availabilityDate');
  });

  it('n’envoie un rayon qu’avec une mobilité autour de la ville', () => {
    const around = buildCandidateAccountPayload(
      form({ mobilityScope: 'RADIUS', mobilityRadiusKm: '30' }),
    );
    const nationwide = buildCandidateAccountPayload(
      form({ mobilityScope: 'NATIONWIDE', mobilityRadiusKm: '30' }),
    );

    expect(around).toMatchObject({ mobilityNationwide: false, mobilityRadiusKm: 30 });
    expect(nationwide).toMatchObject({ mobilityNationwide: true, mobilityRadiusKm: null });
  });

  it('n’envoie aucun champ dérivé ou refusé en écriture par l’API', () => {
    const payload = buildCandidateAccountPayload(form());

    for (const forbidden of ['id', 'userId', 'latitude', 'longitude', 'picture', 'cvUrl']) {
      expect(payload).not.toHaveProperty(forbidden);
    }
  });
});

describe('firstInvalidCandidateField', () => {
  const complete = (overrides: Partial<CandidateAccountForm> = {}): CandidateAccountForm =>
    form({ city: 'Lyon', postalCode: '69003', ...overrides });

  it('accepte un formulaire dont les champs obligatoires sont renseignés', () => {
    expect(firstInvalidCandidateField(complete())).toBeNull();
  });

  it('refuse un prénom vide', () => {
    expect(firstInvalidCandidateField(complete({ firstName: '   ' }))?.field).toBe('firstName');
  });

  it('refuse un nom vide', () => {
    expect(firstInvalidCandidateField(complete({ lastName: '' }))?.field).toBe('lastName');
  });

  /** A commune is mandatory: the profile cannot be left without an address. */
  it('refuse une commune vide', () => {
    expect(firstInvalidCandidateField(complete({ city: '', postalCode: '' }))).toEqual({
      field: 'city',
      message: 'Choisissez votre commune dans la liste.',
    });
  });

  // Half a pair is no address either, and the API refuses it with a 400.
  it('refuse une commune sans code postal', () => {
    expect(firstInvalidCandidateField(complete({ postalCode: '' }))?.field).toBe('city');
  });

  it('refuse un code postal sans commune', () => {
    expect(firstInvalidCandidateField(complete({ city: '  ' }))?.field).toBe('city');
  });
});
