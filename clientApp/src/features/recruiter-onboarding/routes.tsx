import { Navigate, useNavigate } from 'react-router';
import { isRecruiter } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import { RecruiterOnboardingPage } from './RecruiterOnboardingPage';

export function RecruiterOnboardingRoute() {
  const navigate = useNavigate();
  const { status, user } = useAuth();

  // Rendering the form before the session is settled would let a visitor fill
  // five steps and lose everything on the 401 raised by the final request.
  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace />;
  }

  if (!isRecruiter(user?.userType)) {
    return <Navigate to="/" replace />;
  }

  return <RecruiterOnboardingPage userId={user.id} onCompleted={() => navigate('/')} />;
}
