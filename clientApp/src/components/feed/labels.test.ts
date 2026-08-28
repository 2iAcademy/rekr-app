import { describe, expect, it } from 'vitest';
import { offerSalaryLabel } from './labels';

// `contractLabel` and `metaLine` are covered through the recruiter-feed
// re-export; only the salary wording, now shared by the two feeds, was left
// without a test of its own.
describe('offerSalaryLabel', () => {
  it('affiche la fourchette en milliers d’euros', () => {
    expect(offerSalaryLabel(45000, 55000)).toBe('45 - 55 k€');
  });

  it('borne d’un seul côté quand une seule valeur est connue', () => {
    expect(offerSalaryLabel(45000, null)).toBe('À partir de 45 k€');
    expect(offerSalaryLabel(null, 55000)).toBe("Jusqu'à 55 k€");
  });

  it('arrondit au millier le plus proche', () => {
    expect(offerSalaryLabel(41500, 47400)).toBe('42 - 47 k€');
  });

  it('annonce l’absence de salaire plutôt qu’une fourchette vide', () => {
    expect(offerSalaryLabel(null, null)).toBe('Salaire non communiqué');
  });
});
