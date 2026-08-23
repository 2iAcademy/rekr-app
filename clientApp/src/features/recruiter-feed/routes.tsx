import { Navigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { RecruiterFeedPage } from '@/features/recruiter-feed/pages/RecruiterFeedPage';

export function RecruiterFeedRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace />;
  }

  if (user?.userType !== 'recruiter') {
    return <Navigate to="/" replace />;
  }

  return <RecruiterFeedPage />;
}
