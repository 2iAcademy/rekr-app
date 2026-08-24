import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { installDialogDouble } from '@/test/dialog';
import { AppHeader } from './AppHeader';

const items = [
  { label: 'Feed', to: '/recruteur/candidats' },
  { label: 'Matches', to: '/matches' },
  { label: 'Profil', to: '/profil' },
];

const user = { name: 'sacha', role: 'Recruteur' };

installDialogDouble();

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * jsdom implements no `matchMedia` at all, and the project has no double for it.
 * This one exposes the only thing the header uses — a `change` subscription and
 * the current `matches` — plus a handle to cross the breakpoint on demand.
 */
const stubMatchMedia = () => {
  const listeners = new Set<() => void>();
  let matches = false;

  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));

  return {
    crossTo: (next: boolean) => {
      matches = next;

      act(() => {
        for (const listener of [...listeners]) {
          listener();
        }
      });
    },
    listenerCount: () => listeners.size,
  };
};

/**
 * A splat route keeps the header mounted whatever the location, so the same
 * render covers both the active-item assertions and the navigation triggered
 * from the mobile menu.
 */
const renderHeader = (initialPath = '/matches') => {
  const router = createMemoryRouter(
    [{ path: '*', element: <AppHeader items={items} user={user} profileTo="/profil" /> }],
    { initialEntries: [initialPath] },
  );

  return render(<RouterProvider router={router} />);
};

const inlineNavigation = () =>
  screen.getByRole('navigation', { name: 'Navigation de la barre supérieure' });

const openMenu = async (actor: ReturnType<typeof userEvent.setup>) => {
  await actor.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));

  return screen.getByRole('dialog', { name: 'Menu de navigation' });
};

describe('AppHeader', () => {
  it('rend les items de navigation en ligne avec leurs destinations', () => {
    renderHeader();

    const links = within(inlineNavigation()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual(['Feed', 'Matches', 'Profil']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/recruteur/candidats',
      '/matches',
      '/profil',
    ]);
  });

  it('signale l’écran courant dans la navigation en ligne', () => {
    renderHeader('/recruteur/candidats');

    const navigation = within(inlineNavigation());

    expect(navigation.getByRole('link', { name: 'Feed' })).toHaveAttribute('aria-current', 'page');
    expect(navigation.getByRole('link', { name: 'Matches' })).not.toHaveAttribute('aria-current');
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

  it('n’affiche le menu mobile qu’après un clic sur le burger', async () => {
    const actor = userEvent.setup();
    renderHeader();

    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' });

    expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await openMenu(actor);

    expect(burger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Menu de navigation' })).toBeInTheDocument();
  });

  it('ferme le menu mobile au clic sur le bouton de fermeture', async () => {
    const actor = userEvent.setup();
    renderHeader();
    await openMenu(actor);

    await actor.click(screen.getByRole('button', { name: 'Fermer le menu' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  // Closing the panel unmounts the element that held the focus. Without an
  // explicit hand-back the focus drops to the body, and keyboard navigation
  // restarts from the top of the page.
  it('rend le focus au burger à la fermeture du menu', async () => {
    const actor = userEvent.setup();
    renderHeader();
    await openMenu(actor);

    await actor.click(screen.getByRole('button', { name: 'Fermer le menu' }));

    expect(screen.getByRole('button', { name: 'Ouvrir le menu' })).toHaveFocus();
  });

  // A click on the `::backdrop` is dispatched on the dialog element itself.
  it('ferme le menu mobile au clic sur le fond', async () => {
    const actor = userEvent.setup();
    renderHeader();
    const panel = await openMenu(actor);

    await actor.click(panel);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Escape on a modal dialog reaches the page as `cancel`, an event jsdom never
  // raises: dispatching it by hand tests the wiring, the key itself is the
  // browser's job.
  it('ferme le menu mobile quand le navigateur annule le dialogue', async () => {
    const actor = userEvent.setup();
    renderHeader();
    const panel = await openMenu(actor);

    act(() => {
      panel.dispatchEvent(new Event('cancel', { cancelable: true }));
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ferme le menu mobile et navigue au clic sur un item', async () => {
    const actor = userEvent.setup();
    renderHeader();
    const panel = await openMenu(actor);

    await actor.click(within(panel).getByRole('link', { name: 'Matches' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(inlineNavigation()).getByRole('link', { name: 'Matches' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  // Hiding the panel in CSS would leave it open: rotating a phone to landscape
  // would strand the focus on an invisible close button, and coming back under
  // the breakpoint would re-display a menu nobody asked for.
  it('ferme le menu ouvert quand la navigation en ligne prend le relais', async () => {
    const actor = userEvent.setup();
    const mediaQuery = stubMatchMedia();
    renderHeader();
    await openMenu(actor);

    mediaQuery.crossTo(true);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  // The media query fires in both directions: coming back under the breakpoint
  // must leave the menu exactly as the user left it.
  it('laisse le menu ouvert en repassant sous le point de rupture', async () => {
    const actor = userEvent.setup();
    const mediaQuery = stubMatchMedia();
    renderHeader();
    await openMenu(actor);

    mediaQuery.crossTo(false);

    expect(screen.getByRole('dialog', { name: 'Menu de navigation' })).toBeInTheDocument();
  });

  it('retire l’écouteur de requête média au démontage', () => {
    const mediaQuery = stubMatchMedia();
    const { unmount } = renderHeader();

    expect(mediaQuery.listenerCount()).toBe(1);

    unmount();

    expect(mediaQuery.listenerCount()).toBe(0);
  });

  // Every other test in this file already runs without `matchMedia`; this one
  // says out loud that its absence is tolerated rather than incidental.
  it('reste utilisable en l’absence de matchMedia', async () => {
    const actor = userEvent.setup();
    renderHeader();

    expect(window.matchMedia).toBeUndefined();
    await openMenu(actor);

    expect(screen.getByRole('dialog', { name: 'Menu de navigation' })).toBeInTheDocument();
  });

  // jsdom loads no CSS, so the responsive utilities are the only observable
  // trace of the ticket's layout rule: header on mobile and tablet, sidebar
  // from 1440px, and no burger once the items sit inline.
  it('réserve le header au mobile et à la tablette, et le burger au mobile', () => {
    renderHeader();

    expect(screen.getByRole('banner').className).toContain('desktop:hidden');
    expect(screen.getByRole('button', { name: 'Ouvrir le menu' }).className).toContain('md:hidden');
    expect(inlineNavigation().className).toContain('md:flex');
  });

  // Same reason: "no horizontal scroll" is a ticket requirement that only the
  // width utilities can carry in a DOM without layout.
  it('contraint le header à la largeur disponible', () => {
    renderHeader();

    expect(screen.getByRole('banner').className).toContain('w-full');
    expect(inlineNavigation().className).toContain('min-w-0');
  });

  // The 44px touch target is a ticket requirement that jsdom cannot observe:
  // the utility classes are the only trace of the constraint.
  it('donne à chaque élément cliquable du header une zone tactile de 44px', () => {
    renderHeader();

    const clickables = [
      screen.getByRole('button', { name: 'Ouvrir le menu' }),
      screen.getByRole('link', { name: 'Mon profil' }),
      ...within(inlineNavigation()).getAllByRole('link'),
    ];

    for (const element of clickables) {
      expect(element.className).toContain('min-h-11');
      expect(element.className).toContain('min-w-11');
    }
  });
});
