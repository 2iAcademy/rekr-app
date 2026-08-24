import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { CandidateFeedPage } from './pages/CandidateFeedPage';

export function CandidateFeedRoute() {
  const navigate = useNavigate();
  const { status, user } = useAuth();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace />;
  }

  if (user?.userType !== 'candidate') {
    return <Navigate to="/" replace />;
  }

  return <CandidateFeedPage onOpenOffer={(id) => navigate(`/offres/${id}`)} />;
}
