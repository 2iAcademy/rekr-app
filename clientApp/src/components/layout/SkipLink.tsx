import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { MAIN_CONTENT_ID } from './mainContent';

/**
 * First stop of the Tab order on every screen: it jumps over the header and the
 * navigation straight to the `main` landmark. Hidden until it takes the focus.
 *
 * The focus is moved by hand rather than through the fragment: following
 * `#contenu` would push a history entry the router then replays on « back ».
 */
export function SkipLink() {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    const target = document.getElementById(MAIN_CONTENT_ID);
    if (target === null) return;

    event.preventDefault();
    target.focus();
  };

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={handleClick}
      className={cn(
        'fixed top-3 left-3 z-100 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-card',
        'shadow-raised outline-2 outline-offset-2 outline-brand not-focus:sr-only',
      )}
    >
      Aller au contenu
    </a>
  );
}
