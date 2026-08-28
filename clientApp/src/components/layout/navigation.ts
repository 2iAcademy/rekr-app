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
 * The two roles no longer share a shape. Swiping is a candidate's gesture: a
 * recruiter publishes an offer and reads who applied to it, so « Feed » is a
 * candidate entry and « Mes offres » a recruiter one. Each is left out of the
 * other role rather than shown and refused — both screens guard themselves, so
 * the item would only lead straight back to the home page.
 *
 * « Profil », the account item, stays last for both.
 */
export function navigationItems(isRecruiter: boolean): NavigationItem[] {
  return [
    ...(isRecruiter ? [] : [{ label: 'Feed', to: '/candidat/offres' }]),
    { label: 'Matches', to: '/matches' },
    ...(isRecruiter ? [{ label: 'Mes offres', to: '/recruteur/offres' }] : []),
    { label: 'Profil', to: '/profil' },
  ];
}
