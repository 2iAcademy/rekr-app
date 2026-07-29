import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authControllerLogin } from '@/api/generated';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { getAccessToken } from '@/api/tokenStore';
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
};

const renderSignin = (props: Parameters<typeof SigninPage>[0] = {}) =>
  render(
    <AuthProvider>
      <SigninPage {...props} />
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

  it("ne notifie pas le parent quand l'API rejette la connexion", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    loginRequest.mockRejectedValue(new Error('Unauthorized'));
    renderSignin({ onSubmit });

    await user.type(screen.getByLabelText('Email'), 'user@rekr.fr');
    await user.type(screen.getByLabelText('Mot de passe'), 'secret42');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.');
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
