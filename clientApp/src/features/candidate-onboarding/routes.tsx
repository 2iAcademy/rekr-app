import { useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { useAuth } from '@/features/auth/useAuth';
import { CandidateOnboardingPage } from './CandidateOnboardingPage';

export function CandidateOnboardingRoute() {
  const navigate = useNavigate();
  const { markProfileCompleted } = useAuth();

  return (
    <RouteGuard allowedUserTypes={['candidate']} profile="incomplete">
      {(user) => {
        const completed = (): void => {
          markProfileCompleted();
          navigate(homePathFor({ ...user, hasProfile: true }));
        };

        return <CandidateOnboardingPage userId={user.id} onCompleted={completed} />;
      }}
    </RouteGuard>
  );
}
