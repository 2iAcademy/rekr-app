import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { authControllerResetPassword, authControllerSignup } from '@/api/generated';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerSignup: vi.fn(),
  authControllerLogout: vi.fn(),
  authControllerForgotPassword: vi.fn(),
  authControllerResetPassword: vi.fn(),
}));

const signupRequest = vi.mocked(authControllerSignup);
const resetRequest = vi.mocked(authControllerResetPassword);

const authenticatedUser = {
  id: 1,
  email: 'candidat@rekr.fr',
  role: 'user',
  userType: 'candidate',
  isActive: true,
  hasProfile: false,
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

  it('affiche le Splash sur /', async () => {
    renderAt('/');

    expect(await screen.findByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });

  it("navigue du Splash vers l'inscription", async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(await screen.findByRole('button', { name: 'Créer un compte' }));

    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument();
  });

  it('navigue du Splash vers la connexion', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(await screen.findByRole('button', { name: "J'ai déjà un compte" }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it("revient au Splash via le bouton retour de l'inscription", async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.click(await screen.findByRole('button', { name: 'Retour' }));

    expect(screen.getByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });

  it("bascule de l'inscription vers la connexion via le lien", async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.click(await screen.findByRole('button', { name: 'Connexion' }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it("bascule de la connexion vers l'inscription via le lien", async () => {
    const user = userEvent.setup();
    renderAt('/connexion');

    await user.click(await screen.findByRole('button', { name: 'Inscription' }));

    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeInTheDocument();
  });

  it('navigue de la connexion vers le mot de passe oublié', async () => {
    const user = userEvent.setup();
    renderAt('/connexion');

    await user.click(await screen.findByRole('button', { name: 'Mot de passe oublié ?' }));

    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeInTheDocument();
  });

  it('revient à la connexion depuis le mot de passe oublié', async () => {
    const user = userEvent.setup();
    renderAt('/mot-de-passe-oublie');

    await user.click(await screen.findByRole('button', { name: 'Retour' }));

    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('affiche la saisie du nouveau mot de passe sur le lien de réinitialisation', async () => {
    renderAt('/reinitialiser-mot-de-passe?token=jeton-valide');

    expect(
      await screen.findByRole('button', { name: 'Réinitialiser le mot de passe' }),
    ).toBeInTheDocument();
  });

  it("transmet le jeton de l'URL à la réinitialisation", async () => {
    const user = userEvent.setup();
    resetRequest.mockResolvedValue({
      data: undefined,
      status: 204,
      headers: new Headers(),
    } as unknown as Awaited<ReturnType<typeof authControllerResetPassword>>);
    renderAt('/reinitialiser-mot-de-passe?token=jeton-de-lurl');

    await user.type(await screen.findByLabelText('Nouveau mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    await waitFor(() =>
      expect(resetRequest).toHaveBeenCalledWith({
        token: 'jeton-de-lurl',
        password: 'motdepasse1',
      }),
    );

    // Aucune session n'est ouverte : la sortie de l'écran est la connexion.
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('renvoie vers la demande de lien quand le jeton est absent de l’URL', async () => {
    const user = userEvent.setup();
    renderAt('/reinitialiser-mot-de-passe');

    expect(await screen.findByRole('heading', { name: 'Lien invalide.' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Demander un nouveau lien' }));

    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeInTheDocument();
  });

  it('envoie le candidat sur son wizard de profil après une inscription réussie', async () => {
    const user = userEvent.setup();
    renderAt('/inscription');

    await user.type(await screen.findByLabelText('Email'), 'candidat@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    await waitFor(() => expect(signupRequest).toHaveBeenCalled());

    expect(await screen.findByRole('heading', { name: 'Mon identité' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer mon compte' })).toBeNull();
  });

  it('redirige un visiteur anonyme d’une route inconnue vers le Splash', async () => {
    renderAt('/route-inexistante');

    expect(await screen.findByRole('button', { name: "J'ai déjà un compte" })).toBeInTheDocument();
  });
});
