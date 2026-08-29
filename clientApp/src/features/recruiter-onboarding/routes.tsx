import { useNavigate } from 'react-router';
import { homePathFor } from '@/domain/homeRoute';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { useAuth } from '@/features/auth/useAuth';
import { RecruiterOnboardingPage } from './RecruiterOnboardingPage';

export function RecruiterOnboardingRoute() {
  const navigate = useNavigate();
  const { markProfileCompleted } = useAuth();

  return (
    <RouteGuard allowedUserTypes={['recruiter']} profile="incomplete">
      {(user) => {
        const completed = (): void => {
          markProfileCompleted();
          navigate(homePathFor({ ...user, hasProfile: true }));
        };

        return <RecruiterOnboardingPage userId={user.id} onCompleted={completed} />;
      }}
    </RouteGuard>
  );
}
