import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  sectorControllerFindAll: vi.fn(),
}));

const authenticateAs = (userType: 'candidate' | 'recruiter') => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: { id: 1, email: 'a@rekr.fr', role: 'user', userType, isActive: true },
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

    expect(await screen.findByRole('heading', { name: "C'est un match !" })).toBeInTheDocument();
  });

  it('affiche la liste des matches pour un candidat connecté', async () => {
    authenticateAs('candidate');
    renderAt('/matches');

    expect(await screen.findByRole('heading', { name: 'Tes matches' })).toBeInTheDocument();
  });

  it('renvoie un visiteur anonyme vers la connexion depuis la liste des matches', async () => {
    renderAt('/matches');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tes matches' })).not.toBeInTheDocument();
  });

  it('affiche la liste des matches pour un recruteur connecté', async () => {
    authenticateAs('recruiter');
    renderAt('/matches');

    expect(await screen.findByRole('heading', { name: 'Tes matches' })).toBeInTheDocument();
  });

  it('n’affiche pas la liste des matches tant que la session est en cours de vérification', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/matches');

    expect(screen.queryByRole('heading', { name: 'Tes matches' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt('/match');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "C'est un match !" })).not.toBeInTheDocument();
  });

  it('affiche la page pour un recruteur connecté', async () => {
    authenticateAs('recruiter');
    renderAt('/match');

    expect(await screen.findByRole('heading', { name: "C'est un match !" })).toBeInTheDocument();
  });

  it('n’affiche rien tant que la session est en cours de vérification', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/match');

    expect(screen.queryByRole('heading', { name: "C'est un match !" })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('revient à l’accueil après avoir choisi d’écrire un message', async () => {
    const user = userEvent.setup();
    authenticateAs('candidate');
    renderAt('/match');

    await user.click(await screen.findByRole('button', { name: 'Écrire un message' }));

    expect(await screen.findByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });

  it('revient à l’accueil après avoir choisi de continuer à swiper', async () => {
    const user = userEvent.setup();
    authenticateAs('candidate');
    renderAt('/match');

    await user.click(await screen.findByRole('button', { name: 'Continuer à swiper' }));

    expect(await screen.findByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });
});
