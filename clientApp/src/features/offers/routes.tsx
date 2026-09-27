import { useLocation, useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { OfferDetailPage } from '@/features/offers/pages/OfferDetailPage';

/**
 * Where the reader was before they opened this offer, when the screen that sent
 * them here said so. Navigation state is client data: anyone can arrive with
 * anything in it, so only an internal path is followed — an absolute or
 * protocol-relative URL would turn a back button into an open redirect.
 */
const backPath = (state: unknown, fallback: string): string => {
  const from = (state as { from?: unknown } | null)?.from;

  if (typeof from !== 'string' || !from.startsWith('/')) {
    return fallback;
  }

  return from.startsWith('//') || from.startsWith('/\\') ? fallback : from;
};

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
