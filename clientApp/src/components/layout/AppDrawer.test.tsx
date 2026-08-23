import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import { ROLE_THEMES } from '@/lib/roleTheme';
import { AppDrawer } from './AppDrawer';

type UserType = 'candidate' | 'recruiter';

/**
 * The session is injected through the context rather than `AuthProvider`: the
 * drawer only reads the role, and going through the provider would mean faking
 * the boot refresh round-trip for a purely presentational assertion.
 */
const session = (userType: UserType): AuthContextValue => ({
  status: 'authenticated',
  user: { id: 1, email: 'sacha@rekr.fr', role: 'user', userType, isActive: true },
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
});

const renderDrawer = (userType: UserType) => {
  const router = createMemoryRouter(
    [{ element: <AppDrawer />, children: [{ path: '/', element: <p>contenu</p> }] }],
    { initialEntries: ['/'] },
  );

  return render(
    <AuthContext.Provider value={session(userType)}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
};

const feedLinks = () => screen.getAllByRole('link', { name: 'Feed' });

describe('AppDrawer', () => {
  it('rend le contenu de la route enfant dans le landmark principal', () => {
    renderDrawer('recruiter');

    expect(screen.getByRole('main')).toContainElement(screen.getByText('contenu'));
  });

  it('envoie le recruteur sur le feed candidats', () => {
    renderDrawer('recruiter');

    expect(feedLinks()[0]).toHaveAttribute('href', '/recruteur/candidats');
  });

  it('laisse le candidat sur l’accueil tant que son feed n’existe pas', () => {
    renderDrawer('candidate');

    expect(feedLinks()[0]).toHaveAttribute('href', '/');
  });

  it('ouvre le menu mobile sur la même destination', async () => {
    const user = userEvent.setup();
    renderDrawer('recruiter');

    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));

    expect(feedLinks()).toHaveLength(2);
    expect(feedLinks()[1]).toHaveAttribute('href', '/recruteur/candidats');
  });

  // The palette is driven by `[data-role=…]` in index.css, which Vitest never
  // loads: only the attribute value can catch the French/English mismatch that
  // once turned every recruiter screen green.
  it('porte la palette du rôle sur le landmark', () => {
    renderDrawer('recruiter');

    expect(screen.getByRole('main')).toHaveAttribute('data-role', 'recruiter');
    expect(ROLE_THEMES).toContain('recruiter');
  });

  it('bascule la palette pour un candidat', () => {
    renderDrawer('candidate');

    expect(screen.getByRole('main')).toHaveAttribute('data-role', 'candidate');
  });
});
