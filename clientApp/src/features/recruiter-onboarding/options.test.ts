import { describe, it, expect } from 'vitest';
import {
  COMPANY_SIZE_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  REMOTE_POLICY_OPTIONS,
} from './options';
import { COMPANY_SIZES, CONTRACT_TYPES, EXPERIENCE_LEVELS, REMOTE_POLICIES } from './state';

// `satisfies` checks the shape of each option but not that the list covers the
// enum, so a value added to `state.ts` without a label would silently render as
// a missing choice. These tests are the guard.
describe.each([
  ['taille de société', COMPANY_SIZE_OPTIONS, COMPANY_SIZES],
  ['type de contrat', CONTRACT_TYPE_OPTIONS, CONTRACT_TYPES],
  ["niveau d'expérience", EXPERIENCE_LEVEL_OPTIONS, EXPERIENCE_LEVELS],
  ['politique de télétravail', REMOTE_POLICY_OPTIONS, REMOTE_POLICIES],
])('options de %s', (_name, options, values) => {
  it('couvre toutes les valeurs de l’enum, dans l’ordre déclaré', () => {
    expect(options.map((option) => option.value)).toEqual([...values]);
  });

  it('donne un libellé non vide à chaque valeur', () => {
    for (const option of options) {
      expect(option.label.trim()).not.toBe('');
    }
  });

  it('n’utilise pas deux fois le même libellé', () => {
    const labels = options.map((option) => option.label);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('libellés métier', () => {
  it('ne propose que les tailles cibles du produit', () => {
    expect(COMPANY_SIZE_OPTIONS.map((option) => option.value)).toEqual(['TPE', 'PME']);
  });

  it('traduit les niveaux d’expérience en français', () => {
    expect(EXPERIENCE_LEVEL_OPTIONS.find((option) => option.value === 'CONFIRME')?.label).toBe(
      'Confirmé',
    );
  });

  it('traduit les politiques de télétravail en français', () => {
    expect(REMOTE_POLICY_OPTIONS.map((option) => option.label)).toEqual([
      'Sur site',
      'Hybride',
      'Full remote',
    ]);
  });
});
