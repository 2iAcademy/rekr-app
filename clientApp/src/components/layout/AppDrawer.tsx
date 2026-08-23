import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/features/auth/useAuth';

const sharedNavigationItems = [
  { label: 'Feed', to: '/' },
  { label: 'Matches', to: '/matches' },
  { label: 'Profil', to: '/profil' },
];

interface AppNavigationProps {
  items: { label: string; to: string }[];
  onNavigate?: () => void;
}

function AppNavigation({ items, onNavigate }: AppNavigationProps) {
  return (
    <nav className="mt-12" aria-label="Navigation principale">
      <ul className="flex flex-col gap-2 text-xs text-ink-muted">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'block w-full rounded-lg px-3 py-2 text-left transition-colors',
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
  );
}

export function AppDrawer() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const isRecruiter = user?.userType === 'recruiter';

  const userName = user?.email.split('@')[0] ?? 'Toi';
  const userRole = isRecruiter ? 'Recruteur' : 'Candidat';

  return (
    <main className="flex min-h-dvh w-full bg-background">
      <aside className="hidden w-40 shrink-0 flex-col border-r border-line bg-card px-5 py-6 md:flex lg:w-48">
        <Logo size="sm" />

        <AppNavigation items={sharedNavigationItems} />

        <div className="mt-auto flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-violet font-heading text-xs font-bold text-white shadow-violet">
            {userName.charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col text-[0.6rem]">
            <span className="truncate font-semibold text-ink">{userName}</span>
            <span className="text-ink-muted">{userRole}</span>
          </span>
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-6 sm:pt-6 md:px-12 md:pt-12 lg:px-16 lg:pt-16 xl:px-24 xl:pt-20">
        <header className="flex items-center justify-between md:hidden">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink hover:bg-brand-tint"
          >
            <Menu className="size-4" />
          </button>
          <Logo size="sm" />
          <span className="flex size-7 items-center justify-center rounded-full bg-violet font-heading text-[0.6rem] font-bold text-white shadow-violet">
            {userName.charAt(0).toUpperCase()}
          </span>
        </header>

        <Outlet />
      </section>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-ink/30 md:hidden">
          <aside className="h-full w-64 bg-card px-5 py-6 shadow-xl">
            <div className="flex items-center justify-between">
              <Logo size="sm" />
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink hover:bg-brand-tint"
              >
                <X className="size-4" />
              </button>
            </div>

            <AppNavigation
              items={sharedNavigationItems}
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
