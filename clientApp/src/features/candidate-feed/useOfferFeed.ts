import { useCallback, useEffect, useState } from 'react';
import { offerControllerFindFeed, type OfferFeedItemDto } from '@/api/generated';

type FeedStatus = 'loading' | 'ready' | 'failed';

/**
 * How many offers the deck holds. Asked for explicitly rather than inherited
 * from the endpoint's default, so the size is the one this screen decided.
 */
export const FEED_SIZE = 20;

interface UseOfferFeed {
  offers: OfferFeedItemDto[];
  status: FeedStatus;
  reload: () => void;
}

/**
 * The deck of offers to swipe.
 *
 * No filter is passed: the endpoint shapes the deck from the caller's own
 * profile. That is the whole reason the screen has no filter bar — the contract
 * types and the remote policy are edited on the profile, and asking for them
 * again here would give one fact two sources.
 *
 * Answered offers are excluded server-side, so a reload returns the rest of the
 * deck rather than the whole of it again.
 */
export function useOfferFeed(): UseOfferFeed {
  const [offers, setOffers] = useState<OfferFeedItemDto[]>([]);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void offerControllerFindFeed({ limit: FEED_SIZE })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setOffers(response.data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // `status` is reset here rather than in the effect: setting state in an
  // effect body cascades a render, and the retry is the event that starts the
  // reload anyway.
  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((current) => current + 1);
  }, []);

  return { offers, status, reload };
}
