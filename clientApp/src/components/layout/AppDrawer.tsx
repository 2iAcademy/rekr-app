import { Menu } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { Logo } from '@/components/brand/Logo';

const navigationItems = [
  { label: 'Feed', to: '/' },
  { label: 'Matches', to: '/matches' },
  { label: 'Profil', to: '/candidat/profil' },
];

export function AppDrawer() {
  return (
    <main className="flex min-h-dvh w-full bg-background">
      <aside className="hidden w-40 shrink-0 flex-col border-r border-line bg-card px-5 py-6 md:flex lg:w-48">
        <Logo size="sm" />

        <nav className="mt-12" aria-label="Navigation principale">
          <ul className="flex flex-col gap-2 text-xs text-ink-muted">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
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

        <div className="mt-auto flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-violet font-heading text-xs font-bold text-white shadow-violet">
            T
          </span>
          <span className="flex min-w-0 flex-col text-[0.6rem]">
            <span className="truncate font-semibold text-ink">Toi</span>
            <span className="text-ink-muted">Candidat</span>
          </span>
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-4 pt-4 pb-8 sm:px-6 sm:pt-6 md:px-12 md:pt-12 lg:px-16 lg:pt-16 xl:px-24 xl:pt-20">
        <header className="flex items-center justify-between md:hidden">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink hover:bg-brand-tint"
          >
            <Menu className="size-4" />
          </button>
          <Logo size="sm" />
          <span className="flex size-7 items-center justify-center rounded-full bg-violet font-heading text-[0.6rem] font-bold text-white shadow-violet">
            T
          </span>
        </header>

        <Outlet />
      </section>
    </main>
  );
}
