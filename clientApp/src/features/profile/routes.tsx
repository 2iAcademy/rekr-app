import { isRecruiter, userTypeLabel } from '@/domain/userType';
import { RouteGuard } from '@/features/auth/RouteGuard';
import { AccountPage } from '@/features/profile/pages/AccountPage';
import { LogoutButton } from '@/features/profile/components/LogoutButton';
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
          {/* Phone only: the tab bar has room for the destinations alone, while
              the tablet header and the desktop sidebar carry their own. */}
          <div className="mt-6 md:hidden">
            <LogoutButton appearance="row" />
          </div>
        </AccountPage>
      )}
    </RouteGuard>
  );
}
