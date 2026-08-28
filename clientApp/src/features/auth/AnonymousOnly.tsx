import { Navigate, Outlet } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { useAuth } from './useAuth';

/**
 * Layout of the screens that only mean something without a session: the splash,
 * the sign-up, the sign-in and the password reset.
 *
 * The counterpart of the guards the application screens carry. Without it `/`
 * stayed reachable while signed in — and since it is also where every
 * `navigate('/')` in the code base leads, signing in dropped the user back onto
 * the anonymous entry screen they had just left.
 */
export function AnonymousOnly() {
  const { status, user } = useAuth();

  /*
   * The boot refresh has not answered yet. Rendering the form now would flash
   * it at a returning user before the redirect; rendering nothing keeps the
   * screen still for the few milliseconds it takes.
   */
  if (status === 'loading') {
    return null;
  }

  if (status === 'authenticated' && user !== null) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <Outlet />;
}
