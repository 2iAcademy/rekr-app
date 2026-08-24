import { Link, NavLink } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import type { NavigationItem, ShellUser } from './navigation';

interface AppSidebarProps {
  items: NavigationItem[];
  user: ShellUser;
  profileTo: string;
}

export function AppSidebar({ items, user, profileTo }: AppSidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-card px-5 py-6 desktop:flex">
      <Logo size="sm" />

      <nav className="mt-12" aria-label="Navigation principale">
        <ul className="flex flex-col gap-2 text-xs text-ink-muted">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex min-h-11 w-full items-center rounded-lg px-3 text-left transition-colors',
                    isActive
                      ? 'bg-brand-tint font-semibold text-brand-strong'
                      : 'hover:bg-brand-tint',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Link
        to={profileTo}
        aria-label="Mon profil"
        className="mt-auto flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-brand-tint"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet font-heading text-xs font-bold text-white shadow-violet">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col text-[0.6rem]">
          <span className="truncate font-semibold text-ink">{user.name}</span>
          <span className="text-ink-muted">{user.role}</span>
        </span>
      </Link>
    </aside>
  );
}
