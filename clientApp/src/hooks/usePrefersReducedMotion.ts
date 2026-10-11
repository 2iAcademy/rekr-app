import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// jsdom has no `matchMedia`: without it the preference reads as not set.
const mediaQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;

const subscribe = (onChange: () => void): (() => void) => {
  const list = mediaQuery();
  list?.addEventListener('change', onChange);

  return () => list?.removeEventListener('change', onChange);
};

const getSnapshot = (): boolean => mediaQuery()?.matches ?? false;

/**
 * The « reduce motion » setting, for the motion CSS cannot reach: a transform
 * written inline from JavaScript. Follows the setting live.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
