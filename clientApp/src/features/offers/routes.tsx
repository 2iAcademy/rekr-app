import { useLocation, useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { backPath } from '@/lib/backPath';
import { OfferDetailPage } from '@/features/offers/pages/OfferDetailPage';

export function OfferDetailRoute() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <RouteGuard>
      {(user) => {
        const home = homePathFor(user);
        const back = backPath(location.state, home);

        return (
          <OfferDetailPage
            onBack={() => navigate(back)}
            onPass={() => navigate(home)}
            onMatch={(matchedProfile) =>
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
