import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import { clearAccessToken, getAccessToken } from '@/api/tokenStore';

const Probe = () => {
  const { status, user, markProfileCompleted } = useAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <span data-testid="has-profile">{String(user?.hasProfile ?? '')}</span>
      <button type="button" onClick={markProfileCompleted}>
        terminer l’onboarding
      </button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe('AuthProvider', () => {
  beforeEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  /** The access token is volatile by design; the httpOnly cookie is what
   * survives a reload. Trading it for a new token at boot is what keeps the
   * user signed in across refreshes. */
  it('recovers a session at boot from the refresh cookie alone', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        accessToken: 'fresh',
        user: {
          id: 1,
          email: 'back@test.dev',
          role: 'user',
          userType: 'candidate',
          isActive: true,
        },
      }),
    } as unknown as Response);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('back@test.dev');
    expect(getAccessToken()).toBe('fresh');
  });

  /** A visitor who never signed in also lands here. It is the nominal path, not
   * an error, so nothing must be surfaced. */
  it('settles on anonymous when there is no cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(getAccessToken()).toBeNull();
  });

  it('reports loading before the boot refresh settles', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    renderProvider();

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
  });
});

/**
 * The session says whether the onboarding is behind the user, and the router
 * gates on it. Finishing the wizard without telling the session leaves the flag
 * stale for the rest of the visit — so the first navigation after completing it
 * would be sent straight back to the wizard.
 */
describe('AuthProvider — fin de l’onboarding', () => {
  beforeEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  const bootAsProfileLess = () =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        accessToken: 'fresh',
        user: {
          id: 1,
          email: 'camille@test.dev',
          role: 'user',
          userType: 'candidate',
          isActive: true,
          hasProfile: false,
        },
      }),
    } as unknown as Response);

  it('retient que le profil vient d’être créé', async () => {
    bootAsProfileLess();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('has-profile')).toHaveTextContent('false'));

    await userEvent.click(screen.getByRole('button', { name: 'terminer l’onboarding' }));

    expect(screen.getByTestId('has-profile')).toHaveTextContent('true');
  });

  /*
   * The flag is the only thing that changes: rebuilding the user from scratch
   * here would be a second source of truth for the identity the server sent.
   */
  it('laisse le reste de la session intacte', async () => {
    bootAsProfileLess();
    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await userEvent.click(screen.getByRole('button', { name: 'terminer l’onboarding' }));

    expect(screen.getByTestId('email')).toHaveTextContent('camille@test.dev');
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
  });

  /*
   * Called with no session — a wizard left open while the token expired — it
   * must not conjure a half-built user out of nothing.
   */
  it('reste sans effet hors session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    await userEvent.click(screen.getByRole('button', { name: 'terminer l’onboarding' }));

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('has-profile')).toHaveTextContent('');
  });
});
