import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { installDialogDouble } from '@/test/dialog';
import { MobileNavMenu } from './MobileNavMenu';

// The recruiter's own list: it is the longest one the chromes are handed, so a
// spec built on it also answers for the candidate's.
const items = [
  { label: 'Feed', to: '/candidat/offres' },
  { label: 'Matches', to: '/matches' },
  { label: 'Mes offres', to: '/recruteur/offres' },
  { label: 'Profil', to: '/profil' },
];

const { openedAsModal } = installDialogDouble();

const renderMenu = (options?: { strict: boolean }) => {
  const onClose = vi.fn();
  const router = createMemoryRouter(
    [
      { path: '/matches', element: <MobileNavMenu items={items} onClose={onClose} /> },
      // Declaring the other destinations keeps a click on an item out of the
      // router's 404 boundary, which would drown the run in error output.
      { path: '*', element: <p>ailleurs</p> },
    ],
    { initialEntries: ['/matches'] },
  );

  return {
    onClose,
    ...render(<RouterProvider router={router} />, {
      wrapper: options?.strict ? StrictMode : undefined,
    }),
  };
};

const panel = () => screen.getByRole('dialog', { name: 'Menu de navigation' });

describe('MobileNavMenu', () => {
  it('rend les items de navigation avec leurs destinations', () => {
    renderMenu();

    const navigation = screen.getByRole('navigation', { name: 'Navigation du menu' });
    const links = screen.getAllByRole('link');

    expect(navigation).toBeInTheDocument();
    expect(links.map((link) => link.textContent)).toEqual([
      'Feed',
      'Matches',
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

  it('signale l’écran courant dans le menu', () => {
    renderMenu();

    expect(screen.getByRole('link', { name: 'Matches' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Feed' })).not.toHaveAttribute('aria-current');
  });

  // `showModal` rather than `show`: only the modal opening puts the panel in the
  // top layer and makes the rest of the document inert. The previous panel
  // claimed that with `aria-modal` while the page behind it stayed live.
  it('ouvre le panneau en modal', () => {
    renderMenu();

    expect(openedAsModal).toEqual([panel()]);
    expect(panel()).toHaveAttribute('open');
  });

  // `main.tsx` mounts the app under `StrictMode`, which replays mount effects.
  // A second `showModal` on an open dialog throws, so the panel has to give the
  // dialog back on cleanup.
  it('survit au rejeu de l’effet de montage', () => {
    renderMenu({ strict: true });

    expect(panel()).toHaveAttribute('open');
  });

  it('place le focus sur le bouton de fermeture à l’ouverture', () => {
    renderMenu();

    expect(screen.getByRole('button', { name: 'Fermer le menu' })).toHaveFocus();
  });

  it('ferme le menu au clic sur le bouton de fermeture', async () => {
    const user = userEvent.setup();
    const { onClose } = renderMenu();

    await user.click(screen.getByRole('button', { name: 'Fermer le menu' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // A click on the `::backdrop` has the dialog element itself as its target,
  // which is what separates it from a click inside the panel.
  it('ferme le menu au clic sur le fond', async () => {
    const user = userEvent.setup();
    const { onClose } = renderMenu();

    await user.click(panel());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ne ferme pas le menu au clic dans le panneau', async () => {
    const user = userEvent.setup();
    const { onClose } = renderMenu();

    await user.click(screen.getByRole('navigation', { name: 'Navigation du menu' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  // Escape on a modal dialog is delivered as `cancel`. jsdom never raises it, so
  // the event is dispatched by hand: what is under test is the wiring, the key
  // handling itself belongs to the browser.
  it('ferme le menu quand le navigateur annule le dialogue', () => {
    const { onClose } = renderMenu();

    panel().dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // jsdom loads no CSS, so the utility classes are the only trace of the
  // ticket's layout rule: a full-height panel pinned to the left edge, gone as
  // soon as the inline navigation takes over at Tailwind's `md` breakpoint.
  it('reste un panneau latéral plein cadre, masqué à partir de la tablette', () => {
    renderMenu();

    const classes = panel().className;

    for (const utility of ['h-full', 'w-72', 'max-w-[85%]', 'md:hidden']) {
      expect(classes).toContain(utility);
    }
  });

  // The 44px touch target is a ticket requirement that jsdom cannot observe: no
  // CSS is loaded, so the utility classes are the only trace of the constraint.
  it('donne à chaque élément cliquable une zone tactile de 44px', () => {
    renderMenu();

    const clickables = [
      screen.getByRole('button', { name: 'Fermer le menu' }),
      ...screen.getAllByRole('link'),
    ];

    for (const element of clickables) {
      expect(element.className).toContain('min-h-11');
      expect(element.className).toContain('min-w-11');
    }
  });
});
