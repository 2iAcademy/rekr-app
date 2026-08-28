import { describe, it, expect } from 'vitest';
import type { OfferDetailDto } from '@/api/generated';
import { buildOfferPayload, emptyOfferForm, offerFormFromDetail } from './offerPayload';

const filled = {
  ...emptyOfferForm,
  title: 'Développeuse Front',
  description: 'Vous construirez le design system.',
  city: 'Lyon',
  postalCode: '69003',
  skills: ['React', 'TypeScript'],
  contractType: 'CDI' as const,
  minExperienceLevel: 'CONFIRME' as const,
  remotePolicy: 'HYBRID' as const,
  salaryMin: '45000',
  salaryMax: '55000',
  status: 'open' as const,
};

const detail: OfferDetailDto = {
  id: 12,
  companyId: 7,
  createdById: 3,
  title: 'Développeuse Front',
  description: 'Vous construirez le design system.',
  city: 'Lyon',
  postalCode: '69003',
  latitude: '45.7510000',
  longitude: '4.8690000',
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
  salaryMin: 45000,
  salaryMax: 55000,
  status: 'paused',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  company: {
    id: 7,
    name: 'Studio Lumen',
    logo: null,
    size: 'PME',
    description: null,
    city: 'Lyon',
  },
  offerTags: [
    { offerId: 12, tagId: 1, tag: { id: 1, label: 'React', category: 'skill' } },
    { offerId: 12, tagId: 2, tag: { id: 2, label: 'TypeScript', category: 'skill' } },
  ],
};

describe('emptyOfferForm', () => {
  it('ouvre une nouvelle offre en brouillon', () => {
    expect(emptyOfferForm.status).toBe('draft');
  });
});

describe('buildOfferPayload', () => {
  it('construit la charge utile complète d’un formulaire rempli', () => {
    expect(buildOfferPayload(filled, 'create')).toEqual({
      title: 'Développeuse Front',
      description: 'Vous construirez le design system.',
      city: 'Lyon',
      postalCode: '69003',
      skills: ['React', 'TypeScript'],
      contractType: 'CDI',
      minExperienceLevel: 'CONFIRME',
      remotePolicy: 'HYBRID',
      salaryMin: 45000,
      salaryMax: 55000,
      status: 'open',
    });
  });

  it('envoie le statut choisi et non un statut imposé', () => {
    expect(buildOfferPayload({ ...filled, status: 'closed' }, 'create')).toMatchObject({
      status: 'closed',
    });
  });

  it('retire les espaces autour des textes saisis', () => {
    const payload = buildOfferPayload(
      {
        ...filled,
        title: '  Développeuse Front  ',
        description: '  Vous construirez le design system.  ',
      },
      'create',
    );

    expect(payload).toMatchObject({
      title: 'Développeuse Front',
      description: 'Vous construirez le design system.',
    });
  });

  it('omet une fourchette de salaire laissée vide à la création', () => {
    const payload = buildOfferPayload({ ...filled, salaryMin: '', salaryMax: '' }, 'create');

    expect(payload).not.toHaveProperty('salaryMin');
    expect(payload).not.toHaveProperty('salaryMax');
  });

  it('omet une borne de salaire vide sans emporter l’autre à la création', () => {
    const payload = buildOfferPayload({ ...filled, salaryMax: '' }, 'create');

    expect(payload).toMatchObject({ salaryMin: 45000 });
    expect(payload).not.toHaveProperty('salaryMax');
  });

  it('efface en édition une fourchette de salaire vidée, au lieu de la laisser en place', () => {
    const payload = buildOfferPayload({ ...filled, salaryMin: '', salaryMax: '' }, 'update');

    expect(payload).toMatchObject({ salaryMin: null, salaryMax: null });
  });

  it('efface en édition une seule borne sans toucher à l’autre', () => {
    const payload = buildOfferPayload({ ...filled, salaryMax: '' }, 'update');

    expect(payload).toMatchObject({ salaryMin: 45000, salaryMax: null });
  });

  it('n’efface rien en édition tant que les deux bornes sont renseignées', () => {
    expect(buildOfferPayload(filled, 'update')).toMatchObject({
      salaryMin: 45000,
      salaryMax: 55000,
    });
  });

  it('omet les choix non faits plutôt que d’envoyer une chaîne vide', () => {
    const payload = buildOfferPayload(
      {
        ...filled,
        contractType: '',
        minExperienceLevel: '',
        remotePolicy: '',
      },
      'create',
    );

    expect(payload).not.toHaveProperty('contractType');
    expect(payload).not.toHaveProperty('minExperienceLevel');
    expect(payload).not.toHaveProperty('remotePolicy');
  });

  // Les enums, eux, n’acceptent pas `null` côté API : en édition aussi un choix
  // non fait doit rester absent, sinon le PATCH part en 400.
  it('omet encore les choix non faits en édition, sans les passer à null', () => {
    const payload = buildOfferPayload(
      {
        ...filled,
        contractType: '',
        minExperienceLevel: '',
        remotePolicy: '',
      },
      'update',
    );

    expect(payload).not.toHaveProperty('contractType');
    expect(payload).not.toHaveProperty('minExperienceLevel');
    expect(payload).not.toHaveProperty('remotePolicy');
  });

  it('envoie toujours la liste des compétences, pour que l’édition puisse en retirer une', () => {
    expect(buildOfferPayload({ ...filled, skills: ['React'] }, 'update')).toMatchObject({
      skills: ['React'],
    });
  });
});

describe('offerFormFromDetail', () => {
  it('préremplit le formulaire depuis une offre existante', () => {
    expect(offerFormFromDetail(detail)).toEqual({
      title: 'Développeuse Front',
      description: 'Vous construirez le design system.',
      city: 'Lyon',
      postalCode: '69003',
      skills: ['React', 'TypeScript'],
      contractType: 'CDI',
      minExperienceLevel: 'CONFIRME',
      remotePolicy: 'HYBRID',
      salaryMin: '45000',
      salaryMax: '55000',
      status: 'paused',
    });
  });

  it('traduit les colonnes nulles en champs vides', () => {
    const bare = offerFormFromDetail({
      ...detail,
      description: null,
      city: null,
      postalCode: null,
      contractType: null,
      minExperienceLevel: null,
      remotePolicy: null,
      salaryMin: null,
      salaryMax: null,
      offerTags: [],
    });

    expect(bare).toEqual({
      ...emptyOfferForm,
      title: 'Développeuse Front',
      status: 'paused',
    });
  });

  it('ne remonte que les compétences, pas les autres catégories de tags', () => {
    const form = offerFormFromDetail({
      ...detail,
      offerTags: [
        { offerId: 12, tagId: 1, tag: { id: 1, label: 'React', category: 'skill' } },
        { offerId: 12, tagId: 9, tag: { id: 9, label: 'Mutuelle', category: 'benefit' } },
      ],
    });

    expect(form.skills).toEqual(['React']);
  });

  it('rend une offre rechargée telle quelle une fois renvoyée à l’API', () => {
    expect(buildOfferPayload(offerFormFromDetail(detail), 'update')).toMatchObject({
      title: detail.title,
      city: 'Lyon',
      postalCode: '69003',
      salaryMin: 45000,
      salaryMax: 55000,
      status: 'paused',
      skills: ['React', 'TypeScript'],
    });
  });
});
