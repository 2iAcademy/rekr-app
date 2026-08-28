import { Navigate, useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { useAuth } from '@/features/auth/useAuth';
import { OfferDetailPage } from '@/features/offers/pages/OfferDetailPage';

export function OfferDetailRoute() {
  const navigate = useNavigate();
  const { status, user } = useAuth();

  if (status === 'loading') {
    return null;
  }

  /*
   * The one screen that used to carry no guard at all: it sits outside the
   * shell, which is where every other full-frame route inherits one.
   */
  if (status !== 'authenticated' || user === null) {
    return <Navigate to="/connexion" replace />;
  }

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
}
