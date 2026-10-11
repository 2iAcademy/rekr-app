import { Outlet } from 'react-router';
import { SkipLink } from './SkipLink';

/**
 * Wraps every route, so the skip link comes before any screen's own chrome,
 * whichever layout that screen uses.
 */
export function RootLayout() {
  return (
    <>
      <SkipLink />
      <Outlet />
    </>
  );
}
