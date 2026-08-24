import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { authControllerSignup } from '@/api/generated';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerSignup: vi.fn(),
  authControllerLogout: vi.fn(),
}));

const signupRequest = vi.mocked(authControllerSignup);

const authenticatedUser = {
  id: 1,
  email: 'candidat@rekr.fr',
  role: 'user',
  userType: 'candidate',
  isActive: true,
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe('navigation onboarding', () => {
  beforeEach(() => {
    // SigninPage/SignupPage now read `useAuth()`, so every route in this
    // suite needs a provider. Its boot refresh is irrelevant to navigation,
    // so it is stubbed to settle on anonymous straight away.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
    signupRequest.mockResolvedValue({
      data: { accessToken: 'test-token', user: authenticatedUser },
      status: 201,
      headers: new Headers(),
    } as unknown as Awaited<ReturnType<typeof authControllerSignup>>);
  });

  it('affiche le Splash sur /', () => {
    renderAt('/');

    expect(screen.getByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });

  it("navigue du Splash vers l'inscription", async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('button', { name: 'Créer un compte' }));

    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument();
  });

  it('navigue du Splash vers la connexion', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('button', { name: "J'ai déjà un compte" }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it("revient au Splash via le bouton retour de l'inscription", async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.click(screen.getByRole('button', { name: 'Retour' }));

    expect(screen.getByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });

  it("bascule de l'inscription vers la connexion via le lien", async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.click(screen.getByRole('button', { name: 'Connexion' }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it("bascule de la connexion vers l'inscription via le lien", async () => {
    const user = userEvent.setup();
    renderAt('/connexion');

    await user.click(screen.getByRole('button', { name: 'Inscription' }));

    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument();
  });

  it('navigue de la connexion vers le mot de passe oublié', async () => {
    const user = userEvent.setup();
    renderAt('/connexion');

    await user.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));

    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeInTheDocument();
  });

  it('revient à la connexion depuis le mot de passe oublié', async () => {
    const user = userEvent.setup();
    renderAt('/mot-de-passe-oublie');

    await user.click(screen.getByRole('button', { name: 'Retour' }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('envoie le candidat sur son wizard de profil après une inscription réussie', async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.type(screen.getByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    await waitFor(() => expect(signupRequest).toHaveBeenCalled());

    expect(await screen.findByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer mon compte' })).toBeNull();
  });

  it('redirige toute route inconnue vers le Splash', () => {
    renderAt('/route-inexistante');

    expect(screen.getByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });
});
