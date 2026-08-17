import { useNavigate } from 'react-router';
import { OfferDetailPage } from '@/features/offers/pages/OfferDetailPage';

export function OfferDetailRoute() {
  const navigate = useNavigate();

  return (
    <OfferDetailPage
      onBack={() => navigate('/')}
      onPass={() => navigate('/')}
      onLike={(matchedProfile) =>
        navigate('/match', {
          state: { matchedProfile },
        })
      }
    />
  );
}
