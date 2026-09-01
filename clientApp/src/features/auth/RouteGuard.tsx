import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router';
import { homePathFor, needsOnboarding } from '@/domain/homeRoute';
import type { UserType } from '@/domain/userType';
import type { AuthenticatedUser } from './auth-context';
import { useAuth } from './useAuth';

type ProfileRequirement = 'complete' | 'incomplete';

interface RouteGuardProps {
  children?: ReactNode | ((user: AuthenticatedUser) => ReactNode);
  allowedUserTypes?: readonly UserType[];
  profile?: ProfileRequirement;
}

const hasAllowedUserType = (
  userType: string,
  allowedUserTypes: readonly UserType[] | undefined,
): boolean =>
  allowedUserTypes === undefined ||
  allowedUserTypes.some((allowedUserType) => allowedUserType === userType);

/**
 * Single access gate for feature routes.
 *
 * HTTP interceptors can attach credentials to API calls, but they cannot decide
 * which React screen a visitor is allowed to see. This guard owns that UI
 * concern: it waits for the boot refresh, requires a session, checks the role
 * and keeps completed and incomplete profiles on their respective journeys.
 */
export function RouteGuard({ children, allowedUserTypes, profile }: RouteGuardProps) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated' || user === null) {
    return <Navigate to="/connexion" replace />;
  }

  if (!hasAllowedUserType(user.userType, allowedUserTypes)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  if (profile === 'complete' && needsOnboarding(user)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  if (profile === 'incomplete' && user.hasProfile) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  if (typeof children === 'function') {
    return children(user);
  }

  return children ?? <Outlet />;
}
