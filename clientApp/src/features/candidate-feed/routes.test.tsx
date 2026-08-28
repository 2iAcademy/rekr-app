import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { routes } from '@/router';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerLogout: vi.fn(),
  authControllerSignup: vi.fn(),
  candidateProfileControllerCreate: vi.fn(),
  candidateProfileControllerUpdate: vi.fn(),
  companyControllerCreate: vi.fn(),
  companyControllerUpdateMine: vi.fn(),
  matchControllerFindMine: vi.fn().mockResolvedValue({ data: [] }),
  offerControllerCreate: vi.fn(),
  offerControllerFindFeed: vi.fn().mockResolvedValue({ data: [] }),
  offerControllerLike: vi.fn(),
  sectorControllerFindAll: vi.fn(),
}));

const authenticateAs = (userType: 'candidate' | 'recruiter', hasProfile = true) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 1,
        email: 'a@rekr.fr',
        role: 'user',
        userType,
        isActive: true,
        hasProfile,
      },
    }),
  } as unknown as Response);
};

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
};

const feedHeading = () => screen.queryByRole('heading', { level: 1, name: 'Offres' });

describe('navigation vers le feed candidat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
  });

  it('affiche le feed pour un candidat connecté', async () => {
    authenticateAs('candidate');
    renderAt('/candidat/offres');

    expect(await screen.findByRole('heading', { level: 1, name: 'Offres' })).toBeInTheDocument();
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt('/candidat/offres');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(feedHeading()).not.toBeInTheDocument();
  });

  /*
   * Vers son propre feed, pas vers le Splash : se tromper d'écran n'est pas une
   * raison de renvoyer un utilisateur connecté à la porte d'entrée publique.
   */
  it('renvoie un recruteur connecté vers son propre feed', async () => {
    authenticateAs('recruiter');
    renderAt('/candidat/offres');

    expect(await screen.findByRole('heading', { level: 1, name: 'Candidats' })).toBeInTheDocument();
    expect(feedHeading()).not.toBeInTheDocument();
  });

  it('n’affiche rien tant que la session est en cours de vérification', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/candidat/offres');

    expect(feedHeading()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });
});
