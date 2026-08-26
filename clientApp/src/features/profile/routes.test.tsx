import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProfileRoute } from './routes';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerLogout: vi.fn(),
  authControllerSignup: vi.fn(),
}));

const authenticateAs = (userType: 'candidate' | 'recruiter', email = 'camille@rekr.fr') => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: { id: 1, email, role: 'user', userType, isActive: true },
    }),
  } as unknown as Response);
};

// A local route table, not the application one: this spec is about the guards of
// `ProfileRoute` and what it renders. Where the router mounts it is locked by
// `src/router.test.tsx`. The catch-all turns any stray redirect into a visible
// landing spot instead of an unmatched-route error.
const renderProfile = () => {
  const router = createMemoryRouter(
    [
      { path: '/profil', element: <ProfileRoute /> },
      { path: '/connexion', element: <h1>Connexion</h1> },
      { path: '*', element: <h1>Ailleurs</h1> },
    ],
    { initialEntries: ['/profil'] },
  );

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
};

const profileHeading = () => screen.queryByRole('heading', { level: 1, name: 'Profil' });

describe('ProfileRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
  });

  it('affiche le profil d’un candidat connecté', async () => {
    authenticateAs('candidate');
    renderProfile();

    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument();
    expect(screen.getByText('camille@rekr.fr')).toBeInTheDocument();
    expect(screen.getByText('Candidat')).toBeInTheDocument();
  });

  it('affiche le profil d’un recruteur connecté avec son libellé de rôle', async () => {
    authenticateAs('recruiter', 'sacha@acme.fr');
    renderProfile();

    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument();
    expect(screen.getByText('sacha@acme.fr')).toBeInTheDocument();
    expect(screen.getByText('Recruteur')).toBeInTheDocument();
  });

  it('ne redirige plus vers un autre écran pour un utilisateur connecté', async () => {
    authenticateAs('candidate');
    const router = renderProfile();

    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ailleurs' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profil');
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(profileHeading()).not.toBeInTheDocument();
  });

  it('n’affiche rien tant que la session est en cours de vérification', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderProfile();

    expect(profileHeading()).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Connexion' })).not.toBeInTheDocument();
  });
});
