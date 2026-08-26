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
 */
export function navigationItems(isRecruiter: boolean): NavigationItem[] {
  return [
    { label: 'Feed', to: isRecruiter ? '/recruteur/candidats' : '/candidat/offres' },
    { label: 'Matches', to: '/matches' },
    { label: 'Profil', to: '/profil' },
  ];
}
