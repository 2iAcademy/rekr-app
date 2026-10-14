import { useEffect, useState } from 'react';
import { offerControllerFindOneById } from '@/api/generated';

/**
 * The title of the offer the applicants screen is about.
 *
 * The list hands it over through the router state, which costs nothing. A
 * direct visit or a reload carries no state, so the title is then asked of the
 * API instead of being lost: a recruiter with several offers would otherwise
 * read a list of people without knowing which offer they liked.
 */
export function useOfferTitle(offerId: number, handedTitle: string | null): string | null {
  const [fetched, setFetched] = useState<{ offerId: number; title: string } | null>(null);

  useEffect(() => {
    if (handedTitle !== null) {
      return;
    }

    let cancelled = false;

    void offerControllerFindOneById(offerId)
      .then((response) => {
        if (!cancelled) {
          setFetched({ offerId, title: response.data.title.trim() });
        }
      })
      // A reminder, not the content: the screen stays usable without it, and
      // the list itself reports its own failures.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [offerId, handedTitle]);

  if (handedTitle !== null) {
    return handedTitle;
  }

  return fetched?.offerId === offerId && fetched.title !== '' ? fetched.title : null;
}
