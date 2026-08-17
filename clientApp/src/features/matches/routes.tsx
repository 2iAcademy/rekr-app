import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { MatchPage } from '@/features/matches/pages/MatchPage';

interface MatchRouteState {
  matchedProfile?: {
    name: string;
    avatarUrl: string | null;
  };
}

export function MatchRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { matchedProfile = { name: 'Votre match', avatarUrl: null } } =
    (location.state as MatchRouteState | null) ?? {};
  const currentUserName = user?.email.split('@')[0] || 'Toi';

  return (
    <MatchPage
      currentUser={{ name: currentUserName }}
      matchedProfile={matchedProfile}
      onContinue={() => navigate('/')}
      onWriteMessage={() => navigate('/')}
    />
  );
}
