import { Navigate, Outlet } from 'react-router';
import { isRecruiter, userTypeLabel } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import type { RoleTheme } from '@/lib/roleTheme';
import { LogoutButton } from '@/features/profile/components/LogoutButton';
import { AppHeader } from './AppHeader';
import { AppShellSkeleton } from './AppShellSkeleton';
import { AppSidebar } from './AppSidebar';
import { navigationItems, type ShellUser } from './navigation';

const PROFILE_TO = '/profil';

export function AppShell() {
  const { status, user } = useAuth();

  // The layout route mounts before its children, so the guards they carry
  // cannot stop the chrome from being painted: unguarded, the shell shows a
  // recruiter the candidate identity and palette for the whole boot refresh.
  // The skeleton holds the layout without holding either of them.
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

  const roleTheme: RoleTheme = recruiter ? 'recruiter' : 'candidate';
  const items = navigationItems(recruiter);

  return (
    // `data-role` belongs on the outermost element, not on the `main`: index.css
    // redefines the palette's custom properties under `[data-role=…]`, and custom
    // properties only cascade to descendants. Scoped to the `main`, the sidebar
    // and the header would keep the candidate `--line` on a recruiter screen.
    //
    // `overflow-x-clip` rather than `hidden`: `overflow-x: hidden` against a
    // visible `overflow-y` forces the used `overflow-y` to `auto`, making this
    // element a scrollport and therefore the containing block of every
    // `position: sticky` below it — the feed and candidate-detail action bars
    // are `sticky bottom-0` and would anchor here instead of the viewport.
    // `overflow: clip` still forbids the horizontal scroll without that.
    <div data-role={roleTheme} className="flex min-h-dvh w-full overflow-x-clip bg-background">
      <AppSidebar items={items} user={shellUser} profileTo={PROFILE_TO} logout={<LogoutButton />} />

      {/* `min-w-0` lets the column shrink below the intrinsic width of its
          content: without it a wide child pushes the layout and brings back the
          horizontal scroll the ticket forbids. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          items={items}
          user={shellUser}
          profileTo={PROFILE_TO}
          // Tablet only: below `md` the burger menu carries it, above `desktop`
          // the sidebar does. This is the one width served by neither.
          logoutIcon={<LogoutButton appearance="icon" className="hidden md:flex desktop:hidden" />}
          logoutEntry={<LogoutButton className="w-full" />}
        />

        <main className="flex-1 px-4 pt-4 pb-8 sm:px-6 sm:pt-6 md:px-12 md:pt-12 desktop:px-16 desktop:pt-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
