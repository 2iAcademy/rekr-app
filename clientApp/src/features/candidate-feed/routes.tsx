import { Navigate, useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { isCandidate } from '@/domain/userType';
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

  if (!isCandidate(user?.userType)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <CandidateFeedPage onOpenOffer={(id) => navigate(`/offres/${id}`)} />;
}
