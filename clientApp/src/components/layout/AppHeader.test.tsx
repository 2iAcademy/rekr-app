import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppHeader } from './AppHeader';

// Longer than either role's real list, so a spec built on it also answers for
// both of them: the header renders whatever it is handed.
const items = [
  { label: 'Offres', to: '/candidat/offres' },
  { label: 'Matchs', to: '/matches' },
  { label: 'Mes offres', to: '/recruteur/offres' },
  { label: 'Profil', to: '/profil' },
];

const user = { name: 'sacha', role: 'Recruteur' };

/**
 * A splat route keeps the header mounted whatever the location, so the same
 * render covers both the active-item assertions and the navigation triggered
 * from the header's own links.
 */
const renderHeader = (initialPath = '/matches', logoutIcon?: ReactNode) => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <AppHeader items={items} user={user} profileTo="/profil" logoutIcon={logoutIcon} />
        ),
      },
    ],
    { initialEntries: [initialPath] },
  );

  return { ...render(<RouterProvider router={router} />), router };
};

const inlineNavigation = () =>
  screen.getByRole('navigation', { name: 'Navigation de la barre supérieure' });

describe('AppHeader', () => {
  it('rend les items de navigation en ligne avec leurs destinations', () => {
    renderHeader();

    const links = within(inlineNavigation()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Offres',
      'Matchs',
      'Mes offres',
      'Profil',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/candidat/offres',
      '/matches',
      '/recruteur/offres',
      '/profil',
    ]);
  });

  it('signale l’écran courant dans la navigation en ligne', () => {
    renderHeader('/candidat/offres');

    const navigation = within(inlineNavigation());

    expect(navigation.getByRole('link', { name: 'Offres' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(navigation.getByRole('link', { name: 'Matchs' })).not.toHaveAttribute('aria-current');
  });

  it('navigue au clic sur un item en ligne', async () => {
    const actor = userEvent.setup();
    const { router } = renderHeader('/candidat/offres');

    await actor.click(within(inlineNavigation()).getByRole('link', { name: 'Matchs' }));

    expect(router.state.location.pathname).toBe('/matches');
    expect(within(inlineNavigation()).getByRole('link', { name: 'Matchs' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('ramène à l’accueil depuis le logo', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/');
  });

  it('pointe le lien profil sur la destination fournie et affiche l’initiale du nom', () => {
    renderHeader();

    const profileLink = screen.getByRole('link', { name: 'Mon profil' });

    expect(profileLink).toHaveAttribute('href', '/profil');
    expect(profileLink).toHaveTextContent('S');
  });

  // A `NavLink` on the avatar would flag the current screen twice in the same
  // header — once on the « Profil » item, once on the avatar — and a screen
  // reader would announce it twice.
  it('n’annonce l’écran courant qu’une seule fois dans le header', () => {
    renderHeader('/profil');

    const current = within(screen.getByRole('banner'))
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current.map((link) => link.getAttribute('aria-label') ?? link.textContent)).toEqual([
      'Profil',
    ]);
  });

  // On a phone the destinations live in the bottom tab bar: the header must not
  // bring back a second way to the same screens.
  it('ne porte plus de menu burger', () => {
    renderHeader();

    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rend la déconnexion qu’on lui confie', () => {
    renderHeader('/matches', <button type="button">Se déconnecter</button>);

    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Se déconnecter' }),
    ).toBeInTheDocument();
  });

  it('ne rend aucune déconnexion quand on ne lui en confie pas', () => {
    renderHeader();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // jsdom loads no CSS, so the responsive utilities are the only observable
  // trace of the layout rule: header on phone and tablet, sidebar from 1440px,
  // and the destinations inline only from tablet width, the tab bar serving
  // them below.
  it('réserve le header au mobile et à la tablette, et la navigation en ligne à la tablette', () => {
    renderHeader();

    expect(screen.getByRole('banner').className).toContain('desktop:hidden');
    expect(inlineNavigation().className).toContain('hidden');
    expect(inlineNavigation().className).toContain('md:flex');
  });

  // Same reason: "no horizontal scroll" is a requirement that only the width
  // utilities can carry in a DOM without layout.
  it('contraint le header à la largeur disponible', () => {
    renderHeader();

    expect(screen.getByRole('banner').className).toContain('w-full');
    expect(inlineNavigation().className).toContain('min-w-0');
  });

  // The 44px touch target is a requirement that jsdom cannot observe: the
  // utility classes are the only trace of the constraint.
  it('donne à chaque élément cliquable du header une zone tactile de 44px', () => {
    renderHeader();

    const clickables = [
      screen.getByRole('link', { name: 'Accueil' }),
      screen.getByRole('link', { name: 'Mon profil' }),
      ...within(inlineNavigation()).getAllByRole('link'),
    ];

    for (const element of clickables) {
      expect(element.className).toContain('min-h-11');
    }

    for (const element of [
      screen.getByRole('link', { name: 'Mon profil' }),
      ...within(inlineNavigation()).getAllByRole('link'),
    ]) {
      expect(element.className).toContain('min-w-11');
    }
  });
});
