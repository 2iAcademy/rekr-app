import { describe, expect, it } from 'vitest';
import {
  availabilityLabel,
  emptyDeckTitle,
  contractLabel,
  experienceLabel,
  likedCountLabel,
  metaLine,
  mobilityLabel,
  nameWithAge,
  remoteLabel,
  salaryWishLabel,
} from './labels';
import { aCandidate } from './fixtures';
import type { FeedCandidate } from './types';

const candidate = (overrides: Partial<FeedCandidate> = {}): FeedCandidate => ({
  ...aCandidate,
  ...overrides,
});

describe('nameWithAge', () => {
  it('accole le nom et l’âge', () => {
    expect(nameWithAge(candidate({ firstName: 'Camille', lastName: 'Moreau', age: 29 }))).toBe(
      'Camille Moreau · 29 ans',
    );
  });

  it('écarte un fragment de nom vide plutôt que de laisser une espace en tête', () => {
    expect(nameWithAge(candidate({ firstName: '', lastName: 'Moreau', age: 29 }))).toBe(
      'Moreau · 29 ans',
    );
  });

  it('n’affiche que le nom quand l’âge est inconnu', () => {
    expect(nameWithAge(candidate({ firstName: 'Thomas', lastName: 'Leroy', age: null }))).toBe(
      'Thomas Leroy',
    );
  });
});

describe('experienceLabel', () => {
  it('reprend les libellés du référentiel métier', () => {
    expect(experienceLabel('JUNIOR')).toBe('Junior');
    expect(experienceLabel('CONFIRME')).toBe('Confirmé');
    expect(experienceLabel('EXPERT')).toBe('Expert');
  });
});

describe('contractLabel', () => {
  it('reprend les libellés du référentiel métier', () => {
    expect(contractLabel('CDI')).toBe('CDI');
    expect(contractLabel('ALTERNANCE')).toBe('Alternance');
    expect(contractLabel('INTERIM')).toBe('Intérim');
  });
});

describe('remoteLabel', () => {
  it('reprend les libellés du référentiel métier', () => {
    expect(remoteLabel('ON_SITE')).toBe('Sur site');
    expect(remoteLabel('HYBRID')).toBe('Hybride');
    expect(remoteLabel('FULL_REMOTE')).toBe('Full remote');
  });
});

describe('availabilityLabel', () => {
  it('annonce une disponibilité immédiate', () => {
    expect(availabilityLabel(candidate({ availability: 'IMMEDIATE' }))).toBe('Dispo immédiate');
  });

  it('accorde le délai au singulier comme au pluriel', () => {
    expect(
      availabilityLabel(candidate({ availability: 'WITHIN_DELAY', availabilityDelayMonths: 1 })),
    ).toBe('Dispo sous 1 mois');
    expect(
      availabilityLabel(candidate({ availability: 'WITHIN_DELAY', availabilityDelayMonths: 3 })),
    ).toBe('Dispo sous 3 mois');
  });

  it('reste vague quand le délai n’est pas chiffré', () => {
    expect(
      availabilityLabel(candidate({ availability: 'WITHIN_DELAY', availabilityDelayMonths: null })),
    ).toBe('Dispo sous quelques mois');
  });

  it('formate la date précise en français', () => {
    expect(
      availabilityLabel(
        candidate({ availability: 'SPECIFIC_DATE', availabilityDate: '2026-11-02' }),
      ),
    ).toBe('Dispo le 02/11/2026');
  });

  it('reste prudent quand la date annoncée est absente ou illisible', () => {
    expect(
      availabilityLabel(candidate({ availability: 'SPECIFIC_DATE', availabilityDate: null })),
    ).toBe('Dispo à préciser');
    expect(
      availabilityLabel(candidate({ availability: 'SPECIFIC_DATE', availabilityDate: 'bientôt' })),
    ).toBe('Dispo à préciser');
  });
});

describe('mobilityLabel', () => {
  it('annonce une mobilité nationale', () => {
    expect(mobilityLabel(candidate({ mobilityNationwide: true, mobilityRadiusKm: null }))).toBe(
      'Mobile dans toute la France',
    );
  });

  it('fait primer la mobilité nationale sur le rayon renseigné', () => {
    expect(mobilityLabel(candidate({ mobilityNationwide: true, mobilityRadiusKm: 50 }))).toBe(
      'Mobile dans toute la France',
    );
  });

  it('chiffre le rayon quand la mobilité n’est pas nationale', () => {
    expect(mobilityLabel(candidate({ mobilityNationwide: false, mobilityRadiusKm: 30 }))).toBe(
      'Mobile dans un rayon de 30 km',
    );
    expect(mobilityLabel(candidate({ mobilityNationwide: null, mobilityRadiusKm: 100 }))).toBe(
      'Mobile dans un rayon de 100 km',
    );
  });

  it('ne dit rien quand aucune mobilité n’est renseignée', () => {
    expect(
      mobilityLabel(candidate({ mobilityNationwide: null, mobilityRadiusKm: null })),
    ).toBeNull();
  });

  it('traite un rayon nul ou négatif comme une mobilité inconnue', () => {
    expect(mobilityLabel(candidate({ mobilityNationwide: false, mobilityRadiusKm: 0 }))).toBeNull();
    expect(
      mobilityLabel(candidate({ mobilityNationwide: null, mobilityRadiusKm: -10 })),
    ).toBeNull();
  });
});

describe('metaLine', () => {
  it('joint les fragments renseignés par un point médian', () => {
    expect(metaLine(['Lyon', 'Confirmé', 'Disponible immédiatement'])).toBe(
      'Lyon · Confirmé · Disponible immédiatement',
    );
  });

  it('écarte les fragments vides plutôt que de laisser des séparateurs orphelins', () => {
    expect(metaLine([null, 'Confirmé', '', '  ', 'Hybride'])).toBe('Confirmé · Hybride');
  });
});

describe('likedCountLabel', () => {
  it('accorde le décompte au singulier comme au pluriel', () => {
    expect(likedCountLabel(1)).toBe('1 profil liké');
    expect(likedCountLabel(3)).toBe('3 profils likés');
  });

  it('annonce l’absence sans afficher de zéro', () => {
    expect(likedCountLabel(0)).toBe('Aucun profil liké');
  });
});

describe('emptyDeckTitle', () => {
  it('distingue le deck épuisé des filtres trop serrés', () => {
    expect(emptyDeckTitle('no-match')).toBe('Aucun profil ne passe vos filtres');
    expect(emptyDeckTitle('exhausted')).toBe('Vous avez vu tous les profils');
  });
});

describe('salaryWishLabel', () => {
  it('formule la prétention comme la maquette', () => {
    expect(salaryWishLabel(42000, 48000)).toBe('Souhaite 42 - 48 k€');
  });

  it('borne d’un seul côté quand une seule valeur est connue', () => {
    expect(salaryWishLabel(58000, null)).toBe('Souhaite à partir de 58 k€');
    expect(salaryWishLabel(null, 44000)).toBe("Souhaite jusqu'à 44 k€");
  });

  it('arrondit au millier le plus proche', () => {
    expect(salaryWishLabel(41500, 47400)).toBe('Souhaite 42 - 47 k€');
  });

  it('ne construit pas une phrase bancale quand rien n’est communiqué', () => {
    expect(salaryWishLabel(null, null)).toBe('Prétention non communiquée');
  });
});
