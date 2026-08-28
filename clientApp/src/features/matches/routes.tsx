import { MatchesPage } from '@/features/matches/MatchesPage';
import { useLocation, useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { MatchPage } from '@/features/matches/pages/MatchPage';

/**
 * Candidate-only: a match is born of a reciprocal like on one given offer, so a
 * recruiter reads it on the offer concerned rather than in a list spanning every
 * post of their company.
 */
export function MatchesRoute() {
  return (
    <RouteGuard allowedUserTypes={['candidate']}>
      <MatchesPage />
    </RouteGuard>
  );
}

interface MatchRouteState {
  matchedProfile?: {
    name: string;
    avatarUrl: string | null;
  };
}

export function MatchRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { matchedProfile = { name: 'Votre match', avatarUrl: null } } =
    (location.state as MatchRouteState | null) ?? {};

  return (
    <RouteGuard>
      {(user) => {
        const currentUserName = user.email.split('@')[0] || 'Toi';

        return (
          <MatchPage
            currentUser={{ name: currentUserName }}
            matchedProfile={matchedProfile}
            onContinue={() => navigate(homePathFor(user))}
            onWriteMessage={() => navigate(homePathFor(user))}
          />
        );
      }}
    </RouteGuard>
  );
}
