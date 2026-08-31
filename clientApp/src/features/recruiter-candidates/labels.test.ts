import { describe, expect, it } from 'vitest';
import { availabilityLabel, contractLabel, experienceLabel, remoteLabel } from './labels';

/**
 * The showcase projection a recruiter reads is sparse by design: only the first
 * name is guaranteed. Every label therefore has to answer `null` on an unset
 * value, so the caller drops the line rather than asserting something the
 * candidate never filled in.
 */
describe('experienceLabel', () => {
  it('traduit le niveau vers le libellé partagé des formulaires', () => {
    expect(experienceLabel('CONFIRME')).toBe('Confirmé');
  });

  it('rend null quand le niveau n’est pas renseigné', () => {
    expect(experienceLabel(null)).toBeNull();
  });
});

describe('remoteLabel', () => {
  it('traduit la politique de télétravail', () => {
    expect(remoteLabel('HYBRID')).toBe('Hybride');
  });

  it('rend null quand la politique n’est pas renseignée', () => {
    expect(remoteLabel(null)).toBeNull();
  });
});

describe('availabilityLabel', () => {
  it('traduit la disponibilité', () => {
    expect(availabilityLabel('IMMEDIATE')).toBe('Immédiate');
  });

  it('rend null quand la disponibilité n’est pas renseignée', () => {
    expect(availabilityLabel(null)).toBeNull();
  });
});

// Ré-exporté depuis `components/feed/labels` : vérifié ici parce que c'est par
// cette porte que l'écran le consomme.
describe('contractLabel', () => {
  it('traduit le type de contrat', () => {
    expect(contractLabel('ALTERNANCE')).toBe('Alternance');
  });
});
