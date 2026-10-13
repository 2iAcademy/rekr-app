import { useEffect } from 'react';
import { useMatches } from 'react-router';

export const APP_NAME = 'Rekr';

/** What a route declares in its `handle` to name the page it renders. */
export interface TitleHandle {
  title: string;
}

function titleOf(handle: unknown): string | undefined {
  if (typeof handle !== 'object' || handle === null || !('title' in handle)) return undefined;
  return typeof handle.title === 'string' ? handle.title : undefined;
}

/**
 * « Page - Rekr », from the deepest route that names itself; « Rekr » alone
 * otherwise. Every screen used to share the bare app name, so a screen reader
 * announced the same title on each navigation and the browser history listed
 * a column of identical entries (RGAA 8.6).
 */
export function pageTitle(handles: readonly unknown[]): string {
  const title = handles.map(titleOf).findLast((t) => t !== undefined);
  return title ? `${title} - ${APP_NAME}` : APP_NAME;
}

export function useDocumentTitle(): void {
  const matches = useMatches();
  const title = pageTitle(matches.map((match) => match.handle));
  useEffect(() => {
    document.title = title;
  }, [title]);
}
