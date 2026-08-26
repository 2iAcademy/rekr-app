import { Navigate } from 'react-router';
import { userTypeLabel } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';

export function ProfileRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return null;
  }

  // A session without a user is no session: folding it into the guard narrows
  // `user` for the page below without a non-null assertion.
  if (status !== 'authenticated' || user === null) {
    return <Navigate to="/connexion" replace />;
  }

  return <ProfilePage email={user.email} roleLabel={userTypeLabel(user.userType)} />;
}
