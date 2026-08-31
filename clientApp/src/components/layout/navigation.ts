export interface NavigationItem {
  label: string;
  to: string;
}

/**
 * Session data the chromes display. It belongs to the shell's model rather than
 * to one of the presentation components, since both consume it.
 */
export interface ShellUser {
  name: string;
  role: string;
}

/**
 * Main navigation items, in the order the chromes render them.
 *
 * The two roles no longer share a shape. A candidate swipes a deck of offers
 * and follows the matches it produces; a recruiter publishes an offer and reads
 * who applied to it, on the offer itself. « Profil », the account item, is now
 * the only entry they have in common, and it stays last for both.
 *
 * Each entry is left out of the role it does not serve rather than shown and
 * refused: every screen guards itself, so the item would only lead straight
 * back to the home page.
 */
export function navigationItems(isRecruiter: boolean): NavigationItem[] {
  return [
    ...(isRecruiter
      ? [{ label: 'Mes offres', to: '/recruteur/offres' }]
      : [
          { label: 'Feed', to: '/candidat/offres' },
          { label: 'Matches', to: '/matches' },
        ]),
    { label: 'Profil', to: '/profil' },
  ];
}
