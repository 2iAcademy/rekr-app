import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from '@/components/ui/sonner';
import { ApiError } from '@/api/customFetch';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import { LOGOUT_SUCCESS } from '@/features/profile/accountFeedback';
import { LogoutButton } from './LogoutButton';

// The button reads nothing but `logout` from the session, so the context is
// injected directly rather than booting AuthProvider and its refresh round-trip.
const renderLogout = (logout: AuthContextValue['logout']) => {
  render(
    <AuthContext.Provider
      value={{
        status: 'authenticated',
        user: {
          id: 1,
          email: 'camille@rekr.fr',
          role: 'user',
          userType: 'candidate',
          isActive: true,
        },
        login: vi.fn(),
        signup: vi.fn(),
        logout,
      }}
    >
      <LogoutButton />
      <Toaster />
    </AuthContext.Provider>,
  );
};

const trigger = () => screen.getByRole('button', { name: 'Se déconnecter' });

describe('LogoutButton', () => {
  it('termine la session au clic', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);
    renderLogout(logout);

    await user.click(trigger());

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('annonce la déconnexion', async () => {
    const user = userEvent.setup();
    renderLogout(vi.fn().mockResolvedValue(undefined));

    await user.click(trigger());

    const message = await screen.findByText(LOGOUT_SUCCESS);
    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'success');
  });

  it('annonce la déconnexion même quand l’appel au serveur échoue', async () => {
    const user = userEvent.setup();
    // AuthProvider clears the token and the drafts in a `finally` before
    // rethrowing: the session is over locally whatever the server answered.
    const logout = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ status: 500, statusText: '', url: '/api/auth/logout', data: {} }),
      );
    renderLogout(logout);

    await user.click(trigger());

    const message = await screen.findByText(LOGOUT_SUCCESS);
    expect(message.closest('[data-sonner-toast]')).toHaveAttribute('data-type', 'success');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ne laisse pas fuiter le message technique du serveur', async () => {
    const user = userEvent.setup();
    renderLogout(
      vi.fn().mockRejectedValue(
        new ApiError({
          status: 500,
          statusText: '',
          url: '/api/auth/logout',
          data: { message: 'Internal server error' },
        }),
      ),
    );

    await user.click(trigger());

    await screen.findByText(LOGOUT_SUCCESS);
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
  });

  it('désactive le bouton pendant la déconnexion', async () => {
    const user = userEvent.setup();
    renderLogout(vi.fn().mockReturnValue(new Promise(() => {})));

    await user.click(trigger());

    await waitFor(() => {
      expect(trigger()).toBeDisabled();
    });
  });

  it('ne termine la session qu’une fois sur deux clics rapprochés', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockReturnValue(new Promise(() => {}));
    renderLogout(logout);

    await user.click(trigger());
    await user.click(trigger());

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
