import { describe, it, expect } from 'vitest';
import { emptyOfferForm, type OfferFormValue } from './offerPayload';
import { firstOfferError } from './offerValidation';

const valid: OfferFormValue = {
  ...emptyOfferForm,
  title: 'Développeuse Front',
  description: 'Vous construirez le design system.',
  city: 'Lyon',
  postalCode: '69003',
  skills: ['React'],
  contractType: 'CDI',
  minExperienceLevel: 'CONFIRME',
  remotePolicy: 'HYBRID',
};

describe('firstOfferError', () => {
  it('accepte un formulaire complet', () => {
    expect(firstOfferError(valid)).toBeNull();
  });

  it('exige le titre du poste', () => {
    expect(firstOfferError({ ...valid, title: '   ' })).toEqual({
      field: 'title',
      message: 'Renseignez le titre du poste.',
    });
  });

  it('exige les missions du poste', () => {
    expect(firstOfferError({ ...valid, description: '' })).toEqual({
      field: 'description',
      message: 'Décrivez les missions du poste.',
    });
  });

  it('exige au moins une compétence recherchée', () => {
    expect(firstOfferError({ ...valid, skills: [] })).toEqual({
      field: 'skills',
      message: 'Ajoutez au moins une compétence recherchée.',
    });
  });

  it('exige une commune choisie dans la liste', () => {
    expect(firstOfferError({ ...valid, city: '', postalCode: '' })).toEqual({
      field: 'city',
      message: 'Choisissez la commune du poste dans la liste.',
    });
  });

  it('refuse une commune sans code postal, que le champ ville ne produit jamais seule', () => {
    expect(firstOfferError({ ...valid, postalCode: '' })).toMatchObject({ field: 'city' });
  });

  it('exige le type de contrat', () => {
    expect(firstOfferError({ ...valid, contractType: '' })).toEqual({
      field: 'contractType',
      message: 'Choisissez le type de contrat.',
    });
  });

  it('exige l’expérience requise', () => {
    expect(firstOfferError({ ...valid, minExperienceLevel: '' })).toEqual({
      field: 'minExperienceLevel',
      message: 'Choisissez l’expérience requise.',
    });
  });

  it('exige la politique de télétravail', () => {
    expect(firstOfferError({ ...valid, remotePolicy: '' })).toEqual({
      field: 'remotePolicy',
      message: 'Choisissez la politique de télétravail.',
    });
  });

  it('refuse un salaire maximum inférieur au minimum', () => {
    expect(firstOfferError({ ...valid, salaryMin: '55000', salaryMax: '45000' })).toEqual({
      field: 'salaryMax',
      message: 'Le salaire maximum ne peut pas être inférieur au minimum.',
    });
  });

  it('accepte une fourchette de salaire vide', () => {
    expect(firstOfferError({ ...valid, salaryMin: '', salaryMax: '' })).toBeNull();
  });

  it('accepte une borne de salaire seule', () => {
    expect(firstOfferError({ ...valid, salaryMin: '45000', salaryMax: '' })).toBeNull();
    expect(firstOfferError({ ...valid, salaryMin: '', salaryMax: '55000' })).toBeNull();
  });

  it('accepte un salaire maximum égal au minimum', () => {
    expect(firstOfferError({ ...valid, salaryMin: '45000', salaryMax: '45000' })).toBeNull();
  });

  it('signale la première erreur dans l’ordre de lecture du formulaire', () => {
    expect(firstOfferError(emptyOfferForm)).toMatchObject({ field: 'title' });
    expect(firstOfferError({ ...emptyOfferForm, title: 'Poste' })).toMatchObject({
      field: 'description',
    });
  });

  it('n’impose rien sur le statut, qui vaut toujours l’une des valeurs du cycle de vie', () => {
    for (const status of ['draft', 'open', 'paused', 'filled', 'closed'] as const) {
      expect(firstOfferError({ ...valid, status })).toBeNull();
    }
  });
});
