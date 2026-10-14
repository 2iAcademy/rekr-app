import { Outlet } from 'react-router';
import { useDocumentTitle } from './documentTitle';
import { SiteFooter } from './SiteFooter';
import { SkipLink } from './SkipLink';

/**
 * Wraps every route, so the skip link comes before any screen's own chrome,
 * whichever layout that screen uses, and the site footer after it. It also
 * names the document after the route being shown.
 */
export function RootLayout() {
  useDocumentTitle();
  return (
    <>
      <SkipLink />
      <Outlet />
      {/* Same place under every screen. The bottom padding clears the phone tab
          bar of the shell, fixed to the bottom of the viewport. */}
      <SiteFooter className="bg-background px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8" />
    </>
  );
}
