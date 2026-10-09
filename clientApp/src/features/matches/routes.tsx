import { MatchesPage } from '@/features/matches/MatchesPage';
import { useLocation, useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { MatchPage } from '@/features/matches/pages/MatchPage';
import type { MatchedProfile } from '@/features/matches/likeResult';
import { conversationPath } from '@/features/matches/paths';

/**
 * Open to both roles: the screen now also holds the likes left unanswered, and
 * those only exist on one side each — the offers a candidate liked without a
 * match, the candidates who liked a recruiter's offers without a reply. The
 * page picks its tabs from the session's role.
 */
export function MatchesRoute() {
  return (
    <RouteGuard>
      <MatchesPage />
    </RouteGuard>
  );
}

interface MatchRouteState {
  matchedProfile?: MatchedProfile;
}

export function MatchRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  // Without state (a reload, a typed URL) the screen says « Nouveau match »
  // rather than inventing a name.
  const { matchedProfile } = (location.state as MatchRouteState | null) ?? {};

  return (
    <RouteGuard>
      {(user) => {
        const currentUserName = user.email.split('@')[0] || 'Vous';

        return (
          <MatchPage
            currentUser={{ name: currentUserName }}
            matchedProfile={matchedProfile}
            onContinue={() => navigate(homePathFor(user))}
            // The state does not survive a reload; the list of matches is then
            // the nearest place the conversation can be opened from.
            onWriteMessage={() =>
              navigate(matchedProfile ? conversationPath(matchedProfile.matchId) : '/matches')
            }
          />
        );
      }}
    </RouteGuard>
  );
}
