import { Navigate } from 'react-router';
import { isRecruiter, userTypeLabel } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import { AccountPage } from '@/features/profile/pages/AccountPage';
import { CandidateAccountSection } from '@/features/profile/sections/CandidateAccountSection';
import { RecruiterAccountSection } from '@/features/profile/sections/RecruiterAccountSection';

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

  return (
    <AccountPage email={user.email} roleLabel={userTypeLabel(user.userType)}>
      {/* `isRecruiter` treats an unknown user type as a candidate, matching
          `userTypeLabel`: an unrecognised session lands on the narrower half. */}
      {isRecruiter(user.userType) ? <RecruiterAccountSection /> : <CandidateAccountSection />}
    </AccountPage>
  );
}
