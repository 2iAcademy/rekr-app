import { useNavigate } from 'react-router';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { CandidateFeedPage } from './pages/CandidateFeedPage';

export function CandidateFeedRoute() {
  const navigate = useNavigate();

  return (
    <RouteGuard allowedUserTypes={['candidate']}>
      <CandidateFeedPage onOpenOffer={(id) => navigate(`/offres/${id}`)} />
    </RouteGuard>
  );
}
