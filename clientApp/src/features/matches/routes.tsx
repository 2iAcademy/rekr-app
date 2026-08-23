import { MatchesPage } from '@/features/matches/MatchesPage';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { MatchPage } from '@/features/matches/pages/MatchPage';

export function MatchesRoute() {
  return <MatchesPage />;
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
  const { status, user } = useAuth();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace />;
  }

  if (user?.userType !== 'candidate') {
    return <Navigate to="/" replace />;
  }

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
