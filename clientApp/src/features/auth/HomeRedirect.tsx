import { Navigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { useAuth } from './useAuth';

/**
 * Sends whoever lands here to wherever their session belongs.
 *
 * The catch-all used to point at `/` unconditionally, so a mistyped URL dropped
 * a signed-in user on the anonymous splash — the same dead end as signing in.
 */
export function HomeRedirect() {
  const { status, user } = useAuth();

  /*
   * Redirecting on a session that has not settled would send a returning user
   * to the public splash and make them walk back.
   */
  if (status === 'loading') {
    return null;
  }

  return <Navigate to={homePathFor(status === 'authenticated' ? user : null)} replace />;
}
