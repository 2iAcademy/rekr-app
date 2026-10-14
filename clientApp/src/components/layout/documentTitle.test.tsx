import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RootLayout } from './RootLayout';
import { pageTitle } from './documentTitle';

describe('pageTitle', () => {
  it('suffixe le titre de la route la plus profonde par le nom de l’application', () => {
    expect(pageTitle([undefined, { title: 'Activité' }])).toBe('Activité - Rekr');
    expect(pageTitle([{ title: 'Parent' }, { title: 'Enfant' }])).toBe('Enfant - Rekr');
  });

  it('retombe sur le nom de l’application quand aucune route ne se nomme', () => {
    expect(pageTitle([undefined, {}, { title: 42 }])).toBe('Rekr');
  });
});

describe('RootLayout', () => {
  it('nomme le document d’après l’écran affiché', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <RootLayout />,
          children: [{ path: '/profil', handle: { title: 'Mon compte' }, element: <main /> }],
        },
      ],
      { initialEntries: ['/profil'] },
    );
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(document.title).toBe('Mon compte - Rekr'));
  });

  // RGAA 12.1 et 12.4 : le plan du site, second moyen de navigation, au même
  // endroit sous chaque écran.
  it('pose sous l’écran le pied de page et son lien vers le plan du site', () => {
    const router = createMemoryRouter(
      [{ element: <RootLayout />, children: [{ path: '/', element: <main /> }] }],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);

    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Plan du site' })).toHaveAttribute(
      'href',
      '/plan-du-site',
    );
  });
});
