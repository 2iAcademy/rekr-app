import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import { clearAccessToken, getAccessToken } from '@/api/tokenStore';

const Probe = () => {
  const { status, user } = useAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
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
