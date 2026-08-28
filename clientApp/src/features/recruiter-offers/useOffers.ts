import { useCallback, useEffect, useState } from 'react';
import {
  offerControllerFindMine,
  offerControllerUpdate,
  type OfferListItemDto,
} from '@/api/generated';
import type { OfferStatus } from '@/domain/offerStatus';

type OffersStatus = 'loading' | 'ready' | 'failed';

/** `all` is a front-side value: the API asks for no `status` at all. */
export type OfferStatusFilter = OfferStatus | 'all';

/**
 * How many offers the screen shows. Asked for explicitly rather than inherited
 * from the endpoint's default, so the cap the recruiter is warned about is the
 * one this screen decided, and a change of default on the backend cannot move
 * it silently.
 */
export const OFFERS_PAGE_SIZE = 50;

interface UseOffers {
  offers: OfferListItemDto[];
  status: OffersStatus;
  /** The company has offers beyond the page: `offers` is not the whole list. */
  truncated: boolean;
  statusFilter: OfferStatusFilter;
  setStatusFilter: (filter: OfferStatusFilter) => void;
  /** Offer whose status is currently being written, or `null`. */
  pendingId: number | null;
  reload: () => void;
  updateStatus: (id: number, next: OfferStatus) => Promise<void>;
}

/**
 * The recruiter's own offers, all statuses confounded. Same shape as
 * `useSectors`: a three-state machine, an `attempt` counter so a retry re-runs
 * the effect, and a `cancelled` flag so a late answer never writes into an
 * unmounted screen.
 *
 * Filtering goes to the backend rather than being applied here: the list is
 * capped at one page, so filtering client-side would silently search the first
 * page only.
 *
 * There is no pagination UI by product decision, so the page is asked for with
 * one extra offer: getting that sentinel back is the only proof the list is
 * incomplete — the endpoint returns rows, never a total. It is dropped before
 * being shown, which keeps `truncated` exact instead of guessing from a full
 * page, where exactly `OFFERS_PAGE_SIZE` offers would raise a false alarm.
 */
export function useOffers(): UseOffers {
  const [offers, setOffers] = useState<OfferListItemDto[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState<OffersStatus>('loading');
  const [statusFilter, setFilter] = useState<OfferStatusFilter>('all');
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  // `status` is reset by the callers rather than inside the effect: setting
  // state in an effect body cascades a render, and the retry or the filter
  // change is the event that starts the reload anyway.
  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((current) => current + 1);
  }, []);

  const setStatusFilter = useCallback(
    (next: OfferStatusFilter) => {
      if (next === statusFilter) {
        return;
      }

      setStatus('loading');
      setFilter(next);
    },
    [statusFilter],
  );

  useEffect(() => {
    let cancelled = false;

    void offerControllerFindMine({
      limit: OFFERS_PAGE_SIZE + 1,
      ...(statusFilter === 'all' ? {} : { status: statusFilter }),
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setOffers(response.data.slice(0, OFFERS_PAGE_SIZE));
        setTruncated(response.data.length > OFFERS_PAGE_SIZE);
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
  }, [attempt, statusFilter]);

  /**
   * Deliberately not optimistic. The badge is the one thing on the row that
   * states where the offer stands, so painting a status the server has not
   * accepted — then silently rolling it back — would make the screen lie about
   * the database. The row disables its selector while this runs instead, which
   * is honest and costs one round trip on a single PATCH.
   *
   * The confirmed status is read back from the answer rather than assumed from
   * the argument, and the promise is re-thrown so the calling screen owns the
   * user feedback.
   */
  const updateStatus = useCallback(
    async (id: number, next: OfferStatus): Promise<void> => {
      setPendingId(id);

      try {
        const response = await offerControllerUpdate(id, { status: next });
        const confirmed = response.data.status;

        setOffers((current) =>
          current
            .map((offer) => (offer.id === id ? { ...offer, status: confirmed } : offer))
            // An offer that just left the filtered status is no longer part of
            // what the recruiter asked to see; keeping it would show a row the
            // very same request would not return.
            .filter((offer) => statusFilter === 'all' || offer.status === statusFilter),
        );
      } finally {
        setPendingId(null);
      }
    },
    [statusFilter],
  );

  return {
    offers,
    status,
    truncated,
    statusFilter,
    setStatusFilter,
    pendingId,
    reload,
    updateStatus,
  };
}
