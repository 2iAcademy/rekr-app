import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { MobileNavMenu } from './MobileNavMenu';
import type { NavigationItem, ShellUser } from './navigation';

// Tailwind's `md` breakpoint, spelled in the same unit on purpose. The panel
// carries `md:hidden`, so a threshold written in pixels drifts from it as soon
// as the browser's default font size is not 16px: between the two values the
// CSS hides a dialog this effect has not closed, and an open modal nobody
// paints leaves the whole document inert.
const INLINE_NAV_QUERY = '(min-width: 48rem)';

interface AppHeaderProps {
  items: NavigationItem[];
  user: ShellUser;
  profileTo: string;
}

export function AppHeader({ items, user, profileTo }: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);

  // The header owns the panel's lifetime, so it is the one that hands the focus
  // back: closing unmounts the element that held it, and the focus would
  // otherwise fall to the body.
  const closeMenu = () => {
    setIsMenuOpen(false);
    burgerRef.current?.focus();
  };

  // Hiding the panel in CSS would leave it open: the focus would stay on a close
  // button nobody can see, and coming back under the breakpoint would re-display
  // a menu nobody asked for. No focus hand-back here — the burger is hidden at
  // this width, so there is nothing to hand it to.
  useEffect(() => {
    const inlineNav =
      typeof window.matchMedia === 'function' ? window.matchMedia(INLINE_NAV_QUERY) : null;

    if (!inlineNav) {
      return;
    }

    const closeWhenInlineNavTakesOver = () => {
      if (inlineNav.matches) {
        setIsMenuOpen(false);
      }
    };

    inlineNav.addEventListener('change', closeWhenInlineNavTakesOver);

    return () => inlineNav.removeEventListener('change', closeWhenInlineNavTakesOver);
  }, []);

  return (
    <>
      <header className="flex w-full items-center gap-3 border-b border-line bg-card px-4 py-2 desktop:hidden">
        <button
          ref={burgerRef}
          type="button"
          aria-label="Ouvrir le menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
          className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink hover:bg-brand-tint md:hidden"
        >
          <Menu className="size-5" />
        </button>

        {/* The burger and the profile link share the same footprint, which is
            what centres the logo on mobile once the inline nav is hidden. */}
        <Logo size="sm" className="mx-auto md:mx-0" />

        <nav
          aria-label="Navigation de la barre supérieure"
          className="hidden min-w-0 flex-1 md:flex md:justify-center"
        >
          <ul className="flex min-w-0 items-center gap-1 text-sm text-ink-muted">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 transition-colors',
                      isActive
                        ? 'bg-brand-tint font-semibold text-brand-strong'
                        : 'hover:bg-brand-tint',
                    ].join(' ')
                  }
                >
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          to={profileTo}
          aria-label="Mon profil"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-brand-tint"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-violet font-heading text-xs font-bold text-white shadow-violet">
            {user.name.charAt(0).toUpperCase()}
          </span>
        </Link>
      </header>

      {isMenuOpen && <MobileNavMenu items={items} onClose={closeMenu} />}
    </>
  );
}
