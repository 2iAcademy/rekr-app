import { Navigate, Outlet } from 'react-router';
import { isRecruiter, userTypeLabel } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import { LogoutButton } from '@/features/profile/components/LogoutButton';
import { AppHeader } from './AppHeader';
import { AppShellSkeleton } from './AppShellSkeleton';
import { BottomTabBar } from './BottomTabBar';
import { navigationItems, type ShellUser } from './navigation';

const PROFILE_TO = '/profil';

export function AppShell() {
  const { status, user } = useAuth();

  // The layout route mounts before its children, so the guards they carry
  // cannot stop the chrome from being painted: unguarded, the shell shows a
  // recruiter the candidate identity for the whole boot refresh.
  // The skeleton holds the layout without holding that identity.
  if (status === 'loading') {
    return <AppShellSkeleton />;
  }

  // A status without a user is no session: folding it into the guard narrows
  // `user` for the chrome below, which then needs no fallback identity.
  if (status !== 'authenticated' || user === null) {
    return <Navigate to="/connexion" replace />;
  }

  const recruiter = isRecruiter(user.userType);

  const shellUser: ShellUser = {
    name: user.email.split('@')[0],
    role: userTypeLabel(user.userType),
  };

  const items = navigationItems(recruiter);

  return (
    // `--tabbar-h` is the height the phone tab bar takes at the bottom of the
    // viewport, and zero from tablet width up where there is none. The sticky
    // action bars below read it to sit on the tab bar rather than under it.
    //
    // `overflow-x-clip` rather than `hidden`: `overflow-x: hidden` against a
    // visible `overflow-y` forces the used `overflow-y` to `auto`, making this
    // element a scrollport and therefore the containing block of every
    // `position: sticky` below it — the feed and candidate-detail action bars
    // are `sticky bottom-0` and would anchor here instead of the viewport.
    // `overflow: clip` still forbids the horizontal scroll without that.
    <div className="flex min-h-dvh w-full overflow-x-clip bg-background [--tabbar-h:calc(4rem+env(safe-area-inset-bottom))] md:[--tabbar-h:0rem]">
      {/* `min-w-0` lets the column shrink below the intrinsic width of its
          content: without it a wide child pushes the layout and brings back the
          horizontal scroll the ticket forbids. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          items={items}
          user={shellUser}
          profileTo={PROFILE_TO}
          // From tablet width up: below `md` the account page carries it.
          logoutIcon={<LogoutButton appearance="icon" className="hidden md:flex" />}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-[calc(var(--tabbar-h)+2rem)] sm:px-6 sm:pt-6 md:px-10 md:pt-10">
          <Outlet />
        </main>
      </div>

      <BottomTabBar items={items} />
    </div>
  );
}
