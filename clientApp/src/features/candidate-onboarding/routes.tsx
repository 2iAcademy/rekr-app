import { Navigate, useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { isCandidate } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import { CandidateOnboardingPage } from './CandidateOnboardingPage';

export function CandidateOnboardingRoute() {
  const navigate = useNavigate();
  const { status, user, markProfileCompleted } = useAuth();

  // Rendering the form before the session is settled would let a visitor fill
  // four steps and lose everything on the 401 raised by the final request.
  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace />;
  }

  if (!isCandidate(user?.userType)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  /*
   * The wizard creates the profile, so reaching it with one already filled in
   * would offer to overwrite it through a creation form. It stops being home
   * the moment it has been completed.
   */
  if (user.hasProfile) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  /*
   * The flag has to move before the navigation: the destination is computed
   * from it, and leaving it stale would send the user back here.
   */
  const completed = (): void => {
    markProfileCompleted();
    navigate(homePathFor({ ...user, hasProfile: true }));
  };

  return <CandidateOnboardingPage userId={user.id} onCompleted={completed} />;
}
