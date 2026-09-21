import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import { navigationIcon } from './navigationIcon';
import type { NavigationItem, ShellUser } from './navigation';

interface AppSidebarProps {
  items: NavigationItem[];
  user: ShellUser;
  profileTo: string;
  /**
   * The way out of the session, handed down rather than reached for: this
   * chrome is presentational, and calling `useAuth` here would tie it — and its
   * specs — to a provider it otherwise never needs.
   */
  logout?: ReactNode;
}

export function AppSidebar({ items, user, profileTo, logout }: AppSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-card px-4 py-6 desktop:flex">
      <Link
        to="/"
        aria-label="Accueil"
        className="flex min-h-11 items-center self-start rounded-md px-2"
      >
        <Logo size="sm" />
      </Link>

      <nav className="mt-10" aria-label="Navigation principale">
        <ul className="flex flex-col gap-1 text-sm">
          {items.map((item) => {
            const Icon = navigationIcon(item.to);

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-semibold transition-colors',
                      isActive
                        ? 'bg-brand-tint text-brand-strong'
                        : 'text-ink-muted hover:bg-surface hover:text-ink',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
        <Link
          to={profileTo}
          aria-label="Mon profil"
          className="flex min-h-11 min-w-11 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-strong">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col text-xs">
            <span className="truncate font-bold text-ink">{user.name}</span>
            <span className="text-ink-muted">{user.role}</span>
          </span>
        </Link>

        {/* Next to the identity it ends, rather than at the bottom of a form the
          reader has to scroll through to find it. */}
        {logout}
      </div>
    </aside>
  );
}
