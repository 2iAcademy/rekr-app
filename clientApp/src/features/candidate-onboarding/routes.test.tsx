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
  offerControllerFindFeed: vi.fn().mockResolvedValue({ data: [] }),
  offerControllerLike: vi.fn(),
  offerControllerFindMine: vi.fn().mockResolvedValue({ data: [] }),
  sectorControllerFindAll: vi.fn(),
}));

const signupRequest = vi.mocked(authControllerSignup);

/** Makes the provider's boot refresh succeed, which is what authenticates the session. */
const authenticateAs = (userType: 'recruiter' | 'candidate', hasProfile = true) => {
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
          hasProfile: false,
        },
      },
      status: 201,
      headers: new Headers(),
    } as unknown as Awaited<ReturnType<typeof authControllerSignup>>);
  });

  it('affiche le wizard sur /candidat/onboarding pour un candidat connecté', async () => {
    authenticateAs('candidate', false);
    renderAt('/candidat/onboarding');

    expect(await screen.findByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
    expect(screen.getByText('Étape 1 sur 4')).toBeInTheDocument();
  });

  // Without this, a visitor could fill four steps and lose everything on the
  // 401 raised by the very last click.
  it('renvoie un visiteur anonyme vers la connexion', async () => {
    renderAt('/candidat/onboarding');

    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.queryByText('Étape 1 sur 4')).not.toBeInTheDocument();
  });

  /*
   * Not to the public splash, which is where this used to lead: a recruiter has
   * a home of their own, and being on the wrong wizard is no reason to sign out.
   */
  it('renvoie un recruteur connecté vers ses offres', async () => {
    authenticateAs('recruiter');
    renderAt('/candidat/onboarding');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Vos offres' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Étape 1 sur 4')).not.toBeInTheDocument();
  });

  /*
   * The wizard creates the profile; opening it with one already filled in would
   * offer to overwrite it through a creation form.
   */
  it('détourne un candidat qui a déjà rempli son profil', async () => {
    authenticateAs('candidate');
    renderAt('/candidat/onboarding');

    expect(await screen.findByRole('heading', { level: 1, name: 'Offres' })).toBeInTheDocument();
    expect(screen.queryByText('Étape 1 sur 4')).not.toBeInTheDocument();
  });

  it('n’affiche pas le formulaire tant que la session n’est pas tranchée', () => {
    // The boot refresh never settles here, so the guard stays in its loading state.
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderAt('/candidat/onboarding');

    expect(screen.queryByText('Étape 1 sur 4')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
  });

  it('enchaîne l’inscription candidat sur la création de profil', async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.type(await screen.findByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText('Étape 1 sur 4')).toBeInTheDocument();
  });
});
