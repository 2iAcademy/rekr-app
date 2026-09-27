import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { navigationIcon } from './navigationIcon';
import type { NavigationItem } from './navigation';

interface BottomTabBarProps {
  items: NavigationItem[];
}

/**
 * Phone navigation, under the thumb. Every destination stays one tap away
 * instead of behind a menu, which matters on a screen whose main gesture is a
 * swipe. Fixed rather than sticky so it holds whatever the page scrolls; the
 * shell reserves its height through `--tabbar-h`, which the sticky action bars
 * above it read to sit on top of it rather than under it.
 */
export function BottomTabBar({ items }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Onglets de navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]  md:hidden"
    >
      <ul className="flex h-16 items-stretch">
        {items.map((item) => {
          const Icon = navigationIcon(item.to);

          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors',
                    'before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:transition-colors',
                    isActive
                      ? 'text-brand-strong before:bg-brand'
                      : 'text-ink-faint before:bg-transparent hover:text-ink',
                  )
                }
              >
                <Icon aria-hidden="true" className="size-5" />
                {item.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
