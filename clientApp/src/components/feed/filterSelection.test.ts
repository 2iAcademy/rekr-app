import { describe, expect, it } from 'vitest';
import { toggleFilter } from './filterSelection';

describe('toggleFilter', () => {
  const options = [{ value: 'CDI' }, { value: 'CDD' }, { value: 'STAGE' }] as const;

  it('ajoute une valeur à une sélection vide', () => {
    expect(toggleFilter(options, [], 'CDD')).toEqual(['CDD']);
  });

  it('retire une valeur déjà sélectionnée', () => {
    expect(toggleFilter(options, ['CDD'], 'CDD')).toEqual([]);
  });

  it('reconstruit les valeurs dans l’ordre des options', () => {
    expect(toggleFilter(options, ['STAGE'], 'CDI')).toEqual(['CDI', 'STAGE']);
    expect(toggleFilter(options, ['CDI', 'STAGE'], 'CDI')).toEqual(['STAGE']);
  });

  it('ne mute pas la sélection reçue', () => {
    const values = ['CDI'] as const;

    toggleFilter(options, values, 'STAGE');

    expect(values).toEqual(['CDI']);
  });

  it('normalise les doublons dans la sélection', () => {
    expect(toggleFilter(options, ['STAGE', 'CDI', 'STAGE'], 'CDD')).toEqual([
      'CDI',
      'CDD',
      'STAGE',
    ]);
  });
});
