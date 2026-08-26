import { Navigate, useNavigate } from 'react-router';
import { isCandidate } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import { CandidateOnboardingPage } from './CandidateOnboardingPage';

export function CandidateOnboardingRoute() {
  const navigate = useNavigate();
  const { status, user } = useAuth();

  // Rendering the form before the session is settled would let a visitor fill
  // four steps and lose everything on the 401 raised by the final request.
  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace />;
  }

  if (!isCandidate(user?.userType)) {
    return <Navigate to="/" replace />;
  }

  return <CandidateOnboardingPage userId={user.id} onCompleted={() => navigate('/')} />;
}
