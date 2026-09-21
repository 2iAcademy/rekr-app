import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import type { NavigationItem, ShellUser } from './navigation';

interface AppHeaderProps {
  items: NavigationItem[];
  user: ShellUser;
  profileTo: string;
  /**
   * The way out of the session, handed down rather than reached for: this
   * chrome is presentational, and calling `useAuth` here would tie it — and its
   * specs — to a provider it otherwise never needs.
   */
  logoutIcon?: ReactNode;
}

/**
 * Top bar at every width. On a phone it only carries the brand and the way to
 * the account, the destinations living in the bottom tab bar; from tablet
 * width up the destinations join it inline, and its content lines up with the
 * page's centred column.
 */
export function AppHeader({ items, user, profileTo, logoutIcon }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-line bg-card">
      <div className="mx-auto flex h-15 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 md:px-10">
        <Link
          to="/"
          aria-label="Accueil"
          className="flex min-h-11 shrink-0 items-center rounded-md"
        >
          <Logo size="sm" />
        </Link>

        <nav
          aria-label="Navigation de la barre supérieure"
          className="hidden min-w-0 flex-1 md:ml-6 md:flex"
        >
          <ul className="flex min-w-0 items-center gap-1 text-sm">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3.5 font-semibold transition-colors',
                      isActive
                        ? 'bg-brand-tint text-brand-strong'
                        : 'text-ink-muted hover:bg-surface hover:text-ink',
                    )
                  }
                >
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          <Link
            to={profileTo}
            aria-label="Mon profil"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-strong">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </Link>

          {/* From tablet width up: below `md` the account page carries it. */}
          {logoutIcon}
        </div>
      </div>
    </header>
  );
}
