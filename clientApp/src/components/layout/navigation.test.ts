import { describe, expect, it } from 'vitest';
import { navigationItems } from './navigation';

const labels = (isRecruiter: boolean) => navigationItems(isRecruiter).map((item) => item.label);

const itemFor = (isRecruiter: boolean, label: string) =>
  navigationItems(isRecruiter).find((item) => item.label === label);

describe('navigationItems', () => {
  it('rend les entrées principales dans l’ordre d’affichage', () => {
    expect(labels(true)).toEqual(['Mes offres', 'Profil']);
    expect(labels(false)).toEqual(['Feed', 'Matches', 'Profil']);
  });

  // Un recruteur ne parcourt pas un paquet de candidats : il publie une annonce
  // et regarde qui s'y intéresse. Le feed reste un geste de candidat.
  it('ne propose plus de feed au recruteur', () => {
    expect(labels(true)).not.toContain('Feed');
    expect(navigationItems(true).map((item) => item.to)).not.toContain('/recruteur/candidats');
  });

  it('envoie le candidat sur son feed d’offres', () => {
    expect(navigationItems(false)[0]).toEqual({ label: 'Feed', to: '/candidat/offres' });
  });

  it('ouvre la gestion des offres au recruteur', () => {
    expect(itemFor(true, 'Mes offres')).toEqual({ label: 'Mes offres', to: '/recruteur/offres' });
  });

  // The screen is guarded recruiter-side, so a candidate following this entry
  // would only be bounced back to the home page — an item that leads nowhere.
  it('cache la gestion des offres au candidat', () => {
    expect(labels(false)).not.toContain('Mes offres');
    expect(navigationItems(false).map((item) => item.to)).not.toContain('/recruteur/offres');
  });

  it('garde la même destination Profil pour les deux rôles', () => {
    expect(itemFor(true, 'Profil')).toEqual(itemFor(false, 'Profil'));
    expect(itemFor(true, 'Profil')).toEqual({ label: 'Profil', to: '/profil' });
  });

  // Les matches naissent d'un like réciproque sur une annonce donnée : le
  // recruteur les lit sur l'annonce concernée, pas dans une liste globale.
  it('réserve les matches au candidat', () => {
    expect(labels(true)).not.toContain('Matches');
    expect(itemFor(false, 'Matches')).toEqual({ label: 'Matches', to: '/matches' });
  });

  // Every chrome (sidebar, header, mobile panel) calls this on each render and
  // keys its lists on `to`: a duplicated destination would collapse two items.
  it('produit des destinations distinctes', () => {
    for (const isRecruiter of [true, false]) {
      const destinations = navigationItems(isRecruiter).map((item) => item.to);

      expect(new Set(destinations).size).toBe(destinations.length);
    }
  });
});
