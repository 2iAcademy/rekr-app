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
  companyControllerCreate: vi.fn(),
  offerControllerCreate: vi.fn(),
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

const signUpAsRecruiter = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('radio', { name: /recruteur/i }));
  await user.type(screen.getByLabelText('Email'), 'recruteur@rekr.fr');
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));
};

describe('navigation création de profil recruteur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          email: 'recruteur@rekr.fr',
          role: 'user',
          userType: 'recruiter',
          isActive: true,
        },
      },
      status: 201,
      headers: new Headers(),
    } as unknown as Awaited<ReturnType<typeof authControllerSignup>>);
  });

  it('affiche le wizard sur /recruteur/profil pour un recruteur connecté', async () => {
    authenticateAs('recruiter');
    renderAt('/recruteur/profil');

    expect(await screen.findByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
    expect(screen.getByText('Étape 1 sur 5')).toBeInTheDocument();
  });

  // Without this, a visitor could fill five steps and lose everything on the
  // 401 raised by the very last click.
  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt('/recruteur/profil');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mon identité' })).not.toBeInTheDocument();
  });

  it('renvoie un candidat connecté vers l’accueil', async () => {
    authenticateAs('candidate');
    renderAt('/recruteur/profil');

    expect(await screen.findByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mon identité' })).not.toBeInTheDocument();
  });

  it('n’affiche pas le formulaire tant que la session n’est pas tranchée', () => {
    // The boot refresh never settles here, so the guard stays in its loading state.
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/recruteur/profil');

    expect(screen.queryByRole('heading', { name: 'Mon identité' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('enchaîne l’inscription recruteur sur la création de profil', async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await signUpAsRecruiter(user);

    expect(await screen.findByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
  });

  // The candidate onboarding does not exist yet, so signing up as a candidate
  // keeps its previous behaviour (no navigation) rather than landing on the
  // anonymous splash.
  it('n’envoie pas un candidat sur le parcours recruteur', async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(screen.queryByRole('heading', { name: 'Mon identité' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument();
  });
});
