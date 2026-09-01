import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { navigationItems } from './navigation';
import { AppSidebar } from './AppSidebar';

interface RenderOptions {
  path?: string;
  isRecruiter?: boolean;
}

/**
 * The sidebar is mounted on a catch-all route: `NavLink` resolves its active
 * state against the location, so the spec only needs the router to sit at the
 * screen under test — not the real route tree.
 */
const renderSidebar = ({ path = '/recruteur/offres', isRecruiter = true }: RenderOptions = {}) => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <AppSidebar
            items={navigationItems(isRecruiter)}
            user={{ name: 'sacha', role: isRecruiter ? 'Recruteur' : 'Candidat' }}
            profileTo="/profil"
          />
        ),
      },
    ],
    { initialEntries: [path] },
  );

  return render(<RouterProvider router={router} />);
};

// Every link of the navigation landmark, not a chosen few: an allow-list of
// labels here would silently drop a new entry instead of failing on it, which
// is exactly what the specs below are meant to catch.
const navLinks = () =>
  within(screen.getByRole('navigation', { name: 'Navigation principale' }))
    .getAllByRole('link')
    .map((link) => ({
      label: link.textContent,
      href: link.getAttribute('href'),
      current: link.getAttribute('aria-current'),
    }));

describe('AppSidebar', () => {
  it('rend les entrées de navigation du recruteur dans l’ordre, avec leurs destinations', () => {
    renderSidebar();

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(navLinks()).toEqual([
      { label: 'Mes offres', href: '/recruteur/offres', current: 'page' },
      { label: 'Profil', href: '/profil', current: null },
    ]);
  });

  it('reflète l’écran courant sur la seule entrée correspondante', () => {
    renderSidebar({ isRecruiter: false, path: '/candidat/offres' });

    expect(navLinks()).toEqual([
      { label: 'Feed', href: '/candidat/offres', current: 'page' },
      { label: 'Matches', href: '/matches', current: null },
      { label: 'Profil', href: '/profil', current: null },
    ]);
  });

  // Creation and edition live under the list's own path, so the section stays
  // flagged while the recruiter is inside it — losing the highlight there would
  // leave them with no trace of where they are.
  it('garde la section offres active sur les écrans qu’elle contient', () => {
    renderSidebar({ path: '/recruteur/offres/12/edition' });

    expect(navLinks()).toEqual([
      { label: 'Mes offres', href: '/recruteur/offres', current: 'page' },
      { label: 'Profil', href: '/profil', current: null },
    ]);
  });

  it('n’active pas le feed candidat depuis un autre écran', () => {
    renderSidebar({ isRecruiter: false, path: '/matches' });

    expect(navLinks()).toEqual([
      { label: 'Feed', href: '/candidat/offres', current: null },
      { label: 'Matches', href: '/matches', current: 'page' },
      { label: 'Profil', href: '/profil', current: null },
    ]);
  });

  it('fait du bloc profil un lien qui expose le nom et le rôle', () => {
    renderSidebar();

    const profile = screen.getByRole('link', { name: 'Mon profil' });

    expect(profile).toHaveAttribute('href', '/profil');
    expect(profile).toHaveTextContent('sacha');
    expect(profile).toHaveTextContent('Recruteur');
  });

  it('affiche l’initiale du nom en majuscule', () => {
    renderSidebar();

    expect(screen.getByText('S')).toBeInTheDocument();
  });

  // The ticket's "touch targets >= 44px" criterion is not observable in jsdom:
  // no CSS is loaded, so every element reports a zero-sized layout box. The
  // class is the only trace of the constraint left in the DOM.
  it('donne une zone tactile de 44px à chaque élément interactif', () => {
    renderSidebar();

    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('min-h-11');
    }

    expect(screen.getByRole('link', { name: 'Mon profil' }).className).toContain('min-w-11');
  });
});
