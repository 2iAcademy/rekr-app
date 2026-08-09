import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { authControllerSignup } from '@/api/generated';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { routes } from '@/router';

vi.mock('@/api/generated', () => ({
  authControllerSignup: vi.fn(),
  authControllerLogin: vi.fn(),
  authControllerLogout: vi.fn(),
  candidateProfileControllerCreate: vi.fn(),
  candidateProfileControllerUpdate: vi.fn(),
  companyControllerCreate: vi.fn(),
  companyControllerUpdateMine: vi.fn(),
  offerControllerCreate: vi.fn(),
  sectorControllerFindAll: vi.fn(),
}));

const signupRequest = vi.mocked(authControllerSignup);

/** Makes the provider's boot refresh succeed, which is what authenticates the session. */
const authenticateAs = (userType: 'recruiter' | 'candidate') => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      accessToken: 'test-token',
      user: { id: 1, email: 'a@rekr.fr', role: 'user', userType, isActive: true },
    }),
  } as unknown as Response);
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('navigation création de profil candidat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
    signupRequest.mockResolvedValue({
      data: {
        accessToken: 'test-token',
        user: {
          id: 1,
          email: 'candidat@rekr.fr',
          role: 'user',
          userType: 'candidate',
          isActive: true,
        },
      },
      status: 201,
      headers: new Headers(),
    } as unknown as Awaited<ReturnType<typeof authControllerSignup>>);
  });

  it('affiche le wizard sur /candidat/profil pour un candidat connecté', async () => {
    authenticateAs('candidate');
    renderAt('/candidat/profil');

    expect(await screen.findByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
    expect(screen.getByText('Étape 1 sur 4')).toBeInTheDocument();
  });

  // Without this, a visitor could fill four steps and lose everything on the
  // 401 raised by the very last click.
  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt('/candidat/profil');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByText('Étape 1 sur 4')).not.toBeInTheDocument();
  });

  it('renvoie un recruteur connecté vers l’accueil', async () => {
    authenticateAs('recruiter');
    renderAt('/candidat/profil');

    expect(await screen.findByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
    expect(screen.queryByText('Étape 1 sur 4')).not.toBeInTheDocument();
  });

  it('n’affiche pas le formulaire tant que la session n’est pas tranchée', () => {
    // The boot refresh never settles here, so the guard stays in its loading state.
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/candidat/profil');

    expect(screen.queryByText('Étape 1 sur 4')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('enchaîne l’inscription candidat sur la création de profil', async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText('Étape 1 sur 4')).toBeInTheDocument();
  });
});
