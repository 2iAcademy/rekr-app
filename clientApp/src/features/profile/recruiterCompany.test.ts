import { describe, it, expect } from 'vitest';
import type { CompanyResponseDto } from '@/api/generated';
import {
  buildAccountPayload,
  emptyRecruiterAccountForm,
  firstInvalidField,
  formFromCompany,
  readFileKey,
  type RecruiterAccountForm,
} from './recruiterCompany';

const company: CompanyResponseDto = {
  id: 7,
  name: 'Studio Lumen',
  logo: 'logo/7/abc.png',
  size: 'PME',
  sectorId: 4,
  description: 'On éclaire les scènes.',
  siteUrl: 'https://studiolumen.fr',
  coverImage: 'cover-image/7/def.webp',
  city: 'Lyon',
  postalCode: '69003',
  latitude: '45.7510000',
  longitude: '4.8690000',
  benefits: ['Mutuelle', 'Tickets resto'],
  recruiter: { firstName: 'Camille', lastName: 'Martin', jobTitle: 'Responsable RH' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const filled: RecruiterAccountForm = {
  firstName: 'Camille',
  lastName: 'Martin',
  jobTitle: 'Responsable RH',
  name: 'Studio Lumen',
  sectorId: '4',
  size: 'PME',
  city: 'Lyon',
  postalCode: '69003',
  siteUrl: 'https://studiolumen.fr',
  description: 'On éclaire les scènes.',
  benefits: ['Mutuelle', 'Tickets resto'],
};

describe('formFromCompany', () => {
  it('reprend l’identité du recruteur et les informations de la société', () => {
    expect(formFromCompany(company)).toEqual(filled);
  });

  it('rend les champs vides sous forme de chaînes, jamais de null', () => {
    const bare: CompanyResponseDto = {
      ...company,
      logo: null,
      size: null,
      sectorId: null,
      description: null,
      siteUrl: null,
      coverImage: null,
      city: null,
      postalCode: null,
      benefits: [],
      recruiter: { firstName: 'Camille', lastName: 'Martin', jobTitle: null },
    };

    expect(formFromCompany(bare)).toEqual({
      ...emptyRecruiterAccountForm,
      firstName: 'Camille',
      lastName: 'Martin',
      name: 'Studio Lumen',
    });
  });
});

describe('buildAccountPayload', () => {
  it('envoie l’identité et la société débarrassées de leurs espaces', () => {
    expect(
      buildAccountPayload({ ...filled, firstName: '  Camille ', name: ' Studio Lumen  ' }),
    ).toMatchObject({
      firstName: 'Camille',
      lastName: 'Martin',
      name: 'Studio Lumen',
    });
  });

  /** A cleared optional field has to travel as an explicit null: omitting it
   * would leave the stored value in place, which is not what the user did. */
  it('vide poste, secteur et présentation par un null explicite', () => {
    const payload = buildAccountPayload({
      ...filled,
      jobTitle: '   ',
      sectorId: '',
      description: '  ',
    });

    expect(payload.jobTitle).toBeNull();
    expect(payload.sectorId).toBeNull();
    expect(payload.description).toBeNull();
  });

  it('vide le site web par une chaîne vide, que l’API convertit en null', () => {
    expect(buildAccountPayload({ ...filled, siteUrl: '  ' }).siteUrl).toBe('');
  });

  it('convertit le secteur choisi en entier', () => {
    expect(buildAccountPayload({ ...filled, sectorId: '12' }).sectorId).toBe(12);
  });

  it('omet la taille tant qu’aucune n’est choisie', () => {
    expect('size' in buildAccountPayload({ ...filled, size: '' })).toBe(false);
  });

  it('envoie toujours les avantages, y compris une liste vidée', () => {
    expect(buildAccountPayload({ ...filled, benefits: [] }).benefits).toEqual([]);
  });

  it('envoie la ville avec son code postal', () => {
    expect(buildAccountPayload(filled)).toMatchObject({ city: 'Lyon', postalCode: '69003' });
  });

  /** The API refuses a lone city and derives the coordinates from the pair, so
   * a half-filled location must never leave the form. */
  it('omet la localisation quand la commune n’est pas renseignée', () => {
    const payload = buildAccountPayload({ ...filled, city: '', postalCode: '' });

    expect('city' in payload).toBe(false);
    expect('postalCode' in payload).toBe(false);
  });

  it('n’envoie jamais les coordonnées, dérivées côté serveur', () => {
    const payload = buildAccountPayload(filled);

    expect('latitude' in payload).toBe(false);
    expect('longitude' in payload).toBe(false);
    expect('logo' in payload).toBe(false);
    expect('coverImage' in payload).toBe(false);
    expect('id' in payload).toBe(false);
  });
});

describe('firstInvalidField', () => {
  it('ne signale rien sur un formulaire complet', () => {
    expect(firstInvalidField(filled)).toBeNull();
  });

  it('signale les champs obligatoires dans l’ordre de lecture', () => {
    expect(firstInvalidField({ ...filled, firstName: ' ', lastName: '', name: '' })?.field).toBe(
      'firstName',
    );
    expect(firstInvalidField({ ...filled, lastName: '', name: '' })?.field).toBe('lastName');
    expect(firstInvalidField({ ...filled, name: '  ' })?.field).toBe('name');
  });

  it('accompagne chaque refus d’un message pour l’utilisateur', () => {
    expect(firstInvalidField({ ...filled, firstName: '' })?.message).toBe(
      'Renseignez votre prénom.',
    );
  });

  /** A commune is mandatory, whether or not one was already stored. */
  it('refuse une commune vide', () => {
    expect(firstInvalidField({ ...filled, city: '', postalCode: '' })).toEqual({
      field: 'city',
      message: 'Choisissez votre commune dans la liste.',
    });
  });

  // Half a pair is no address either, and the API refuses it with a 400.
  it('refuse une commune sans code postal', () => {
    expect(firstInvalidField({ ...filled, postalCode: '' })?.field).toBe('city');
  });

  it('refuse un code postal sans commune', () => {
    expect(firstInvalidField({ ...filled, city: '  ' })?.field).toBe('city');
  });
});

describe('readFileKey', () => {
  it('lit la nouvelle clé dans la ligne renvoyée par l’écriture', () => {
    expect(readFileKey({ id: 7, logo: 'logo/7/new.png' }, 'logo')).toBe('logo/7/new.png');
  });

  it('rend null quand l’emplacement a été vidé', () => {
    expect(readFileKey({ id: 7, coverImage: null }, 'coverImage')).toBeNull();
  });

  it('rend null plutôt que d’échouer sur un corps inattendu', () => {
    expect(readFileKey(undefined, 'logo')).toBeNull();
    expect(readFileKey(null, 'logo')).toBeNull();
    expect(readFileKey('logo/7/new.png', 'logo')).toBeNull();
    expect(readFileKey({ logo: 42 }, 'logo')).toBeNull();
  });
});
