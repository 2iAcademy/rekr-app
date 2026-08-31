import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/customFetch';
import {
  offerControllerFindApplicants,
  offerControllerLikeApplicant,
  type OfferApplicantDto,
} from '@/api/generated';

type ApplicantsStatus = 'loading' | 'ready' | 'missing' | 'failed';

/**
 * How many applicants the screen shows. Asked for explicitly rather than
 * inherited from the endpoint's default, so the cap is the one this screen
 * decided and a change of default on the backend cannot move it silently.
 */
export const APPLICANTS_PAGE_SIZE = 50;

interface UseApplicants {
  applicants: OfferApplicantDto[];
  status: ApplicantsStatus;
  /** More applicants than one page: `applicants` is not the whole list. */
  truncated: boolean;
  /** Candidates this recruiter has already answered, by user id. */
  liked: ReadonlySet<number>;
  /** Candidate whose like is currently being written, or `null`. */
  pendingId: number | null;
  reload: () => void;
  like: (candidateUserId: number) => Promise<void>;
}

/**
 * The candidates who applied to one offer.
 *
 * Same shape as `useOffers`: a state machine, an `attempt` counter so a retry
 * re-runs the effect, and a `cancelled` flag so a late answer never writes into
 * an unmounted screen.
 *
 * `missing` is its own state rather than a failure: a 404 means the offer is
 * not this company's — or does not exist — which is a screen to word, not an
 * error to retry.
 *
 * The likes already given are held here rather than read back from the API:
 * nothing exposes them today, so the set starts empty and only remembers what
 * this session wrote. A recruiter reopening the screen sees the buttons armed
 * again — a duplicate is harmless, the endpoint is idempotent.
 */
export function useApplicants(offerId: number): UseApplicants {
  const [applicants, setApplicants] = useState<OfferApplicantDto[]>([]);
  const [status, setStatus] = useState<ApplicantsStatus>('loading');
  const [truncated, setTruncated] = useState(false);
  const [liked, setLiked] = useState<ReadonlySet<number>>(new Set());
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // One more than the page: enough to know the list is cut without asking for
    // a count the endpoint does not serve.
    void offerControllerFindApplicants(offerId, {
      page: 1,
      limit: APPLICANTS_PAGE_SIZE + 1,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        const page = response.data;
        setApplicants(page.slice(0, APPLICANTS_PAGE_SIZE));
        setTruncated(page.length > APPLICANTS_PAGE_SIZE);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }

        setStatus(cause instanceof ApiError && cause.status === 404 ? 'missing' : 'failed');
      });

    return () => {
      cancelled = true;
    };
  }, [offerId, attempt]);

  /**
   * `status` is reset here rather than in the effect: setting state in an effect
   * body cascades a render, and the retry is the event that starts the reload
   * anyway. Same reasoning as `useOffers`.
   */
  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((current) => current + 1);
  }, []);

  /**
   * Deliberately not optimistic: the button reads « intérêt enregistré » once
   * the write is acknowledged, and showing that before the server agreed would
   * be claiming something that may not have happened.
   */
  const like = useCallback(
    async (candidateUserId: number): Promise<void> => {
      setPendingId(candidateUserId);

      try {
        await offerControllerLikeApplicant(offerId, candidateUserId);
        setLiked((current) => new Set(current).add(candidateUserId));
      } finally {
        setPendingId(null);
      }
    },
    [offerId],
  );

  return { applicants, status, truncated, liked, pendingId, reload, like };
}
