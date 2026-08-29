import { useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { OfferDetailPage } from '@/features/offers/pages/OfferDetailPage';

export function OfferDetailRoute() {
  const navigate = useNavigate();

  return (
    <RouteGuard>
      {(user) => {
        const home = homePathFor(user);

        return (
          <OfferDetailPage
            onBack={() => navigate(home)}
            onPass={() => navigate(home)}
            onLike={(matchedProfile) =>
              navigate('/match', {
                state: { matchedProfile },
              })
            }
          />
        );
      }}
    </RouteGuard>
  );
}
