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
 * Until now the two roles were served the same three items with only the feed
 * re-targeted; offer management is the first entry one role has and the other
 * does not. It is left out for a candidate rather than shown and refused: the
 * screen is guarded recruiter-side, so the item would lead a candidate straight
 * back to the home page.
 *
 * Inserted after « Matches » so the pair both roles share keeps its order and
 * « Profil », the account item, stays last.
 */
export function navigationItems(isRecruiter: boolean): NavigationItem[] {
  return [
    { label: 'Feed', to: isRecruiter ? '/recruteur/candidats' : '/candidat/offres' },
    { label: 'Matches', to: '/matches' },
    ...(isRecruiter ? [{ label: 'Mes offres', to: '/recruteur/offres' }] : []),
    { label: 'Profil', to: '/profil' },
  ];
}
