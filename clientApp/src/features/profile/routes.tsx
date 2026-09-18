import { isRecruiter, userTypeLabel } from '@/domain/userType';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { AccountPage } from '@/features/profile/pages/AccountPage';
import { CandidateAccountSection } from '@/features/profile/sections/CandidateAccountSection';
import { RecruiterAccountSection } from '@/features/profile/sections/RecruiterAccountSection';

export function ProfileRoute() {
  return (
    <RouteGuard>
      {(user) => (
        <AccountPage email={user.email} roleLabel={userTypeLabel(user.userType)}>
          {/* `isRecruiter` treats an unknown user type as a candidate, matching
              `userTypeLabel`: an unrecognised session lands on the narrower half. */}
          {isRecruiter(user.userType) ? <RecruiterAccountSection /> : <CandidateAccountSection />}
        </AccountPage>
      )}
    </RouteGuard>
  );
}
