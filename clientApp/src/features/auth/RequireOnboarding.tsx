import { Navigate, Outlet } from 'react-router';
import { homePathFor, needsOnboarding } from '@/domain/homeRoute';
import { useAuth } from './useAuth';

/**
 * Layout of every screen that assumes a filled-in profile.
 *
 * A feed has an empty deck without one and the matching has nothing to compare,
 * so an unfinished wizard is the only place such a session can usefully be. The
 * wizards themselves sit outside this layout — inside it, the gate would send
 * the session to the very screen it is guarding.
 *
 * Sessions it does not recognise are handed straight through: the screens below
 * carry their own session and role guards, and duplicating them here would only
 * make two redirects out of one.
 */
export function RequireOnboarding() {
  const { status, user } = useAuth();

  if (needsOnboarding(status === 'authenticated' ? user : null)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <Outlet />;
}
