import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '@/features/auth/auth-context';
import { homePathFor, needsOnboarding } from './homeRoute';

const userOf = (overrides: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 1,
  email: 'camille@rekr.fr',
  role: 'user',
  userType: 'candidate',
  isActive: true,
  hasProfile: true,
  ...overrides,
});

describe('homePathFor', () => {
  it('envoie un candidat instruit vers son feed', () => {
    expect(homePathFor(userOf({ userType: 'candidate' }))).toBe('/candidat/offres');
  });

  it('envoie un recruteur instruit vers son feed', () => {
    expect(homePathFor(userOf({ userType: 'recruiter' }))).toBe('/recruteur/candidats');
  });

  /*
   * Un feed sans profil n'a rien à afficher et le matching n'a rien à comparer :
   * la seule destination utile est le formulaire qui manque.
   */
  it('envoie un candidat sans profil vers son onboarding', () => {
    expect(homePathFor(userOf({ userType: 'candidate', hasProfile: false }))).toBe(
      '/candidat/onboarding',
    );
  });

  it('envoie un recruteur sans profil vers son onboarding', () => {
    expect(homePathFor(userOf({ userType: 'recruiter', hasProfile: false }))).toBe(
      '/recruteur/onboarding',
    );
  });

  /*
   * Sans session il n'y a pas de « chez soi » : la porte d'entrée publique est
   * la seule réponse possible.
   */
  it('renvoie un visiteur anonyme vers l’accueil public', () => {
    expect(homePathFor(null)).toBe('/');
  });

  /*
   * `userType` arrive du serveur en chaîne libre, et le type `admin` existe déjà
   * en base sans posséder ni profil candidat ni profil recruteur. Le renvoyer
   * vers un onboarding qu'il ne peut pas remplir le ferait rebondir sans fin
   * entre la garde de rôle du wizard et cette destination.
   */
  it('envoie un type de compte sans parcours dédié vers les matches', () => {
    expect(homePathFor(userOf({ userType: 'admin', hasProfile: false }))).toBe('/matches');
  });
});

describe('needsOnboarding', () => {
  it('reconnaît un candidat qui n’a pas rempli son profil', () => {
    expect(needsOnboarding(userOf({ userType: 'candidate', hasProfile: false }))).toBe(true);
  });

  it('reconnaît un recruteur qui n’a pas rempli son profil', () => {
    expect(needsOnboarding(userOf({ userType: 'recruiter', hasProfile: false }))).toBe(true);
  });

  it('laisse passer un profil rempli', () => {
    expect(needsOnboarding(userOf({ hasProfile: true }))).toBe(false);
  });

  /*
   * Un type de compte sans wizard n'a rien à remplir : le déclarer en attente
   * d'onboarding l'enverrait vers un écran qui le refuserait aussitôt.
   */
  it('n’attend rien d’un type de compte sans parcours dédié', () => {
    expect(needsOnboarding(userOf({ userType: 'admin', hasProfile: false }))).toBe(false);
  });

  it('n’attend rien d’un visiteur anonyme', () => {
    expect(needsOnboarding(null)).toBe(false);
  });
});
