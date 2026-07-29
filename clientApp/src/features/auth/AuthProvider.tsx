import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authControllerLogin, authControllerLogout, authControllerSignup } from '@/api/generated';
import { clearAccessToken, onSessionExpired, setAccessToken } from '@/api/tokenStore';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type AuthenticatedUser,
} from './auth-context';

interface SessionPayload {
  accessToken: string;
  user: AuthenticatedUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const adopt = useCallback((session: SessionPayload) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const abandon = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Boot: the access token died with the previous page, the cookie did not.
  // Trading one for the other is what makes a reload invisible to the user.
  useEffect(() => {
    let cancelled = false;

    void fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) {
          return;
        }

        if (!res.ok) {
          abandon();

          return;
        }

        adopt((await res.json()) as SessionPayload);
      })
      .catch(() => {
        if (!cancelled) {
          abandon();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adopt, abandon]);

  useEffect(() => onSessionExpired(abandon), [abandon]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authControllerLogin({ email, password });
      adopt(res.data as unknown as SessionPayload);
    },
    [adopt],
  );

  const signup = useCallback(
    async (email: string, password: string, userType: string) => {
      const res = await authControllerSignup({
        email,
        password,
        userType,
      } as Parameters<typeof authControllerSignup>[0]);
      adopt(res.data as unknown as SessionPayload);
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    try {
      await authControllerLogout();
    } finally {
      abandon();
    }
  }, [abandon]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, signup, logout }),
    [status, user, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
