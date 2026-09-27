import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { routes } from '@/router';

vi.mock('@/api/generated', () => ({
  likeControllerFindSent: vi.fn().mockResolvedValue({ data: [] }),
  likeControllerFindReceived: vi.fn().mockResolvedValue({ data: [] }),
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
  offerControllerFindMine: vi.fn().mockResolvedValue({ data: [] }),
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
  return router;
};

describe('navigation vers le match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
  });

  it('affiche la page pour un candidat connecté', async () => {
    authenticateAs('candidate');
    renderAt('/match');

    expect(await screen.findByRole('heading', { name: 'Nouveau match' })).toBeInTheDocument();
  });

  it('affiche la liste des matches pour un candidat connecté', async () => {
    authenticateAs('candidate');
    renderAt('/matches');

    expect(await screen.findByRole('heading', { name: 'Matchs' })).toBeInTheDocument();
  });

  it('renvoie un visiteur anonyme vers la connexion depuis la liste des matches', async () => {
    renderAt('/matches');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Matchs' })).not.toBeInTheDocument();
  });

  // L'écran sert désormais les deux rôles : le recruteur y lit ses matches et
  // les candidats qui ont liké une de ses offres sans réponse de sa part.
  it('ouvre la liste des matches à un recruteur connecté', async () => {
    authenticateAs('recruiter');
    const router = renderAt('/matches');

    expect(
      await screen.findByRole('heading', { name: 'Matchs' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/matches'));
    expect(screen.getByRole('tab', { name: 'Reçus' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Mes likes' })).not.toBeInTheDocument();
  });

  // Changer d'onglet n'est pas une étape du parcours : l'empiler rendrait le
  // bouton Retour du navigateur inutilisable.
  it('n’empile pas d’entrée d’historique en changeant d’onglet', async () => {
    const user = userEvent.setup();
    authenticateAs('candidate');
    const router = renderAt('/matches');

    await user.click(await screen.findByRole('tab', { name: 'Mes likes' }));

    await waitFor(() => expect(router.state.location.search).toBe('?onglet=mes-likes'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('réserve l’onglet des likes envoyés au candidat', async () => {
    authenticateAs('candidate');
    renderAt('/matches');

    expect(await screen.findByRole('tab', { name: 'Mes likes' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Reçus' })).not.toBeInTheDocument();
  });

  it('n’affiche pas la liste des matches tant que la session est en cours de vérification', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/matches');

    expect(screen.queryByRole('heading', { name: 'Matchs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt('/match');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nouveau match' })).not.toBeInTheDocument();
  });

  it('affiche la page pour un recruteur connecté', async () => {
    authenticateAs('recruiter');
    renderAt('/match');

    expect(await screen.findByRole('heading', { name: 'Nouveau match' })).toBeInTheDocument();
  });

  it('n’affiche rien tant que la session est en cours de vérification', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/match');

    expect(screen.queryByRole('heading', { name: 'Nouveau match' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('revient au feed après avoir choisi d’écrire un message', async () => {
    const user = userEvent.setup();
    authenticateAs('candidate');
    renderAt('/match');

    await user.click(await screen.findByRole('button', { name: 'Écrire un message' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Offres' })).toBeInTheDocument();
  });

  it('revient au feed après avoir choisi de continuer à swiper', async () => {
    const user = userEvent.setup();
    authenticateAs('candidate');
    renderAt('/match');

    await user.click(await screen.findByRole('button', { name: 'Continuer à swiper' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Offres' })).toBeInTheDocument();
  });
});
