import { describe, expect, it } from 'vitest';
import { navigationItems } from './navigation';

describe('navigationItems', () => {
  it('rend les trois entrées principales dans l’ordre d’affichage', () => {
    expect(navigationItems(true).map((item) => item.label)).toEqual(['Feed', 'Matches', 'Profil']);
    expect(navigationItems(false).map((item) => item.label)).toEqual(['Feed', 'Matches', 'Profil']);
  });

  it('envoie le recruteur sur le feed candidats', () => {
    expect(navigationItems(true)[0]).toEqual({ label: 'Feed', to: '/recruteur/candidats' });
  });

  it('envoie le candidat sur son feed d’offres', () => {
    expect(navigationItems(false)[0]).toEqual({ label: 'Feed', to: '/candidat/offres' });
  });

  it('garde les mêmes destinations Matches et Profil pour les deux rôles', () => {
    const recruiter = navigationItems(true).slice(1);
    const candidate = navigationItems(false).slice(1);

    expect(recruiter).toEqual([
      { label: 'Matches', to: '/matches' },
      { label: 'Profil', to: '/profil' },
    ]);
    expect(candidate).toEqual(recruiter);
  });

  // Every chrome (sidebar, header, mobile panel) calls this on each render and
  // keys its lists on `to`: a duplicated destination would collapse two items.
  it('produit des destinations distinctes', () => {
    const destinations = navigationItems(true).map((item) => item.to);

    expect(new Set(destinations).size).toBe(destinations.length);
  });
});
