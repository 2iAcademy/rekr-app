import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { BottomTabBar } from './BottomTabBar';
import { navigationItems } from './navigation';

interface RenderOptions {
  path?: string;
  isRecruiter?: boolean;
}

/**
 * A catch-all route keeps the bar mounted whatever the location: `NavLink`
 * resolves its active state against it, so the spec only needs the router to
 * sit at the screen under test.
 */
const renderTabBar = ({ path = '/candidat/offres', isRecruiter = false }: RenderOptions = {}) => {
  const router = createMemoryRouter(
    [{ path: '*', element: <BottomTabBar items={navigationItems(isRecruiter)} /> }],
    { initialEntries: [path] },
  );

  return { ...render(<RouterProvider router={router} />), router };
};

const tabBar = () => screen.getByRole('navigation', { name: 'Onglets de navigation' });

// Every link of the landmark, not a chosen few: an allow-list here would
// silently drop a new entry instead of failing on it.
const tabs = () =>
  within(tabBar())
    .getAllByRole('link')
    .map((link) => ({
      label: link.textContent,
      href: link.getAttribute('href'),
      current: link.getAttribute('aria-current'),
    }));

describe('BottomTabBar', () => {
  it('rend les onglets du candidat dans l’ordre, avec leurs destinations', () => {
    renderTabBar();

    expect(tabs()).toEqual([
      { label: 'Offres', href: '/candidat/offres', current: 'page' },
      { label: 'Matchs', href: '/matches', current: null },
      { label: 'Profil', href: '/profil', current: null },
    ]);
  });

  it('rend les onglets du recruteur, sans feed', () => {
    renderTabBar({ isRecruiter: true, path: '/profil' });

    expect(tabs()).toEqual([
      { label: 'Mes offres', href: '/recruteur/offres', current: null },
      { label: 'Matchs', href: '/matches', current: null },
      { label: 'Profil', href: '/profil', current: 'page' },
    ]);
  });

  // Creation and edition live under the list's own path: the tab stays lit
  // while the recruiter is inside it.
  it('garde l’onglet offres actif sur les écrans qu’il contient', () => {
    renderTabBar({ isRecruiter: true, path: '/recruteur/offres/12/edition' });

    expect(tabs()).toEqual([
      { label: 'Mes offres', href: '/recruteur/offres', current: 'page' },
      { label: 'Matchs', href: '/matches', current: null },
      { label: 'Profil', href: '/profil', current: null },
    ]);
  });

  it('déplace l’onglet courant au clic', async () => {
    const actor = userEvent.setup();
    const { router } = renderTabBar();

    await actor.click(within(tabBar()).getByRole('link', { name: 'Matchs' }));

    expect(router.state.location.pathname).toBe('/matches');
    expect(tabs().filter((tab) => tab.current === 'page')).toEqual([
      { label: 'Matchs', href: '/matches', current: 'page' },
    ]);
  });

  // The glyph sits above the label, never in its place: the accessible name
  // stays the visible text, and the icon is not announced twice.
  it('accompagne chaque onglet d’une icône décorative', () => {
    renderTabBar();

    for (const link of within(tabBar()).getAllByRole('link')) {
      const icon = link.querySelector('svg');

      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  // jsdom loads no CSS: the utilities are the only trace of the layout rules.
  // Phone only — from tablet width the header carries the destinations — and
  // pinned to the bottom of the viewport whatever the page scrolls.
  it('se réserve au téléphone et reste fixée en bas de l’écran', () => {
    renderTabBar();

    expect(tabBar().className).toContain('md:hidden');
    expect(tabBar().className).toContain('fixed');
    expect(tabBar().className).toContain('bottom-0');
  });

  // Each tab fills its share of a 64px bar (`h-16` on the list, `h-full` on the
  // link), which clears the 44px touch target in both directions.
  it('donne à chaque onglet une zone tactile d’au moins 44px', () => {
    renderTabBar();

    const list = within(tabBar()).getByRole('list');

    expect(list.className).toContain('h-16');

    for (const link of within(tabBar()).getAllByRole('link')) {
      expect(link.className).toContain('h-full');
      expect(link.closest('li')?.className).toContain('flex-1');
    }
  });
});
