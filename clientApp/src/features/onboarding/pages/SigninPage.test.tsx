import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authControllerLogin } from '@/api/generated';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { getAccessToken } from '@/api/tokenStore';
import { ApiError } from '@/api/customFetch';
import { Toaster } from '@/components/ui/sonner';
import { SigninPage } from './SigninPage';

vi.mock('@/api/generated', () => ({
  authControllerLogin: vi.fn(),
  authControllerSignup: vi.fn(),
  authControllerLogout: vi.fn(),
}));

const loginRequest = vi.mocked(authControllerLogin);

const authenticatedUser = {
  id: 1,
  email: 'user@rekr.fr',
  role: 'user',
  userType: 'candidate',
  isActive: true,
  hasProfile: true,
};

const apiError = (status: number, data: unknown) =>
  new ApiError({ status, statusText: '', url: '/api/auth/login', data });

const renderSignin = (props: Parameters<typeof SigninPage>[0] = {}) =>
  render(
    <AuthProvider>
      <SigninPage {...props} />
      <Toaster />
    </AuthProvider>,
  );

describe('SigninPage', () => {
  beforeEach(() => {
    // The provider always fires a boot refresh on mount; without a token to
    // adopt here, it settles on anonymous and leaves these tests unaffected.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);
    loginRequest.mockResolvedValue({
      data: { accessToken: 'test-token', user: authenticatedUser },
      status: 200,
      headers: new Headers(),
    } as unknown as Awaited<ReturnType<typeof authControllerLogin>>);
  });

  it('soumet email et mot de passe', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderSignin({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(loginRequest).toHaveBeenCalledWith({ email: 'user@rekr.fr', password: 'secret42' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@rekr.fr', password: 'secret42' });
  });

  it('confirme la connexion par un toast de succès', async () => {
    const user = userEvent.setup();
    renderSignin();

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    const message = await screen.findByText('Vous êtes connecté.');

    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'success');
  });

  it("affiche un toast d'identifiants incorrects sur un 401 et ne notifie pas le parent", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    loginRequest.mockRejectedValue(
      apiError(401, { statusCode: 401, message: 'Invalid email or password.' }),
    );
    renderSignin({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    const message = await screen.findByText(
      'Email ou mot de passe incorrect. Réessayez ou réinitialisez votre mot de passe.',
    );

    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'error');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('annonce un compte désactivé sur un 403, sans le confondre avec des identifiants incorrects', async () => {
    const user = userEvent.setup();
    loginRequest.mockRejectedValue(
      apiError(403, { statusCode: 403, message: 'This account is inactive.' }),
    );
    renderSignin();

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText('Ce compte est désactivé. Contactez-nous pour le réactiver.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mot de passe incorrect/)).not.toBeInTheDocument();
    expect(screen.queryByText('This account is inactive.')).not.toBeInTheDocument();
  });

  it('invite à patienter sur un 429', async () => {
    const user = userEvent.setup();
    loginRequest.mockRejectedValue(
      apiError(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' }),
    );
    renderSignin();

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText('Trop de tentatives. Patientez une minute avant de réessayer.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ThrottlerException/)).not.toBeInTheDocument();
  });

  it('reste génerique sur un 500 sans exposer le message technique', async () => {
    const user = userEvent.setup();
    loginRequest.mockRejectedValue(
      apiError(500, { statusCode: 500, message: 'Internal server error' }),
    );
    renderSignin();

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText('Une erreur est survenue. Réessayez dans un instant.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
  });

  it('signale un problème de connexion quand la requête n’aboutit pas', async () => {
    const user = userEvent.setup();
    loginRequest.mockRejectedValue(new TypeError('Failed to fetch'));
    renderSignin();

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText(
        'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.',
      ),
    ).toBeInTheDocument();
  });

  it('permet d’afficher le mot de passe saisi', async () => {
    const user = userEvent.setup();
    renderSignin();

    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');

    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));

    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('secret42');
  });

  it('déclenche onBack et onSignUp sur les liens de navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onSignUp = vi.fn();
    renderSignin({ onBack, onSignUp });

    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await user.click(screen.getByRole('button', { name: 'Inscription' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  /** The access token is what proves the session survived sign-in: it is held
   * by the provider, not by SigninPage, so this only passes once the page is
   * wired onto `useAuth()` instead of calling the API directly. */
  it('keeps the session after a successful sign-in', async () => {
    const user = userEvent.setup();
    renderSignin();

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(getAccessToken()).toBe('test-token'));
  });
});
