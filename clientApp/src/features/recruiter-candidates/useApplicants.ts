import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/customFetch';
import {
  offerControllerFindApplicants,
  offerControllerLikeApplicant,
  offerControllerPassApplicant,
  type LikeResultDto,
  type OfferApplicantDto,
} from '@/api/generated';

type ApplicantsStatus = 'loading' | 'ready' | 'missing' | 'failed';

export type ApplicantDecision = { kind: 'liked' | 'passed'; at: string } | null;

/** How many applicants the screen shows on one page. */
export const APPLICANTS_PAGE_SIZE = 50;

interface UseApplicants {
  applicants: OfferApplicantDto[];
  status: ApplicantsStatus;
  truncated: boolean;
  pendingId: number | null;
  reload: () => void;
  like: (candidateUserId: number) => Promise<LikeResultDto>;
  pass: (candidateUserId: number) => Promise<void>;
  decisionFor: (candidateUserId: number) => ApplicantDecision;
}

function decisionFrom(applicant: OfferApplicantDto): ApplicantDecision {
  const likedAt = applicant.recruiterLikedAt;
  const passedAt = applicant.recruiterPassedAt;

  if (likedAt !== null && likedAt !== undefined && (!passedAt || likedAt >= passedAt)) {
    return { kind: 'liked', at: likedAt };
  }
  if (passedAt !== null && passedAt !== undefined) {
    return { kind: 'passed', at: passedAt };
  }
  return null;
}

/** The candidates who applied to one offer, plus this recruiter's saved decision. */
export function useApplicants(offerId: number): UseApplicants {
  const [applicants, setApplicants] = useState<OfferApplicantDto[]>([]);
  const [status, setStatus] = useState<ApplicantsStatus>('loading');
  const [truncated, setTruncated] = useState(false);
  const [decisions, setDecisions] = useState<ReadonlyMap<number, ApplicantDecision>>(new Map());
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void offerControllerFindApplicants(offerId, {
      page: 1,
      limit: APPLICANTS_PAGE_SIZE + 1,
    })
      .then((response) => {
        if (cancelled) return;

        const page = response.data;
        const visible = page.slice(0, APPLICANTS_PAGE_SIZE);
        setApplicants(visible);
        setDecisions(
          new Map(visible.map((applicant) => [applicant.userId, decisionFrom(applicant)])),
        );
        setTruncated(page.length > APPLICANTS_PAGE_SIZE);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setStatus(cause instanceof ApiError && cause.status === 404 ? 'missing' : 'failed');
      });

    return () => {
      cancelled = true;
    };
  }, [offerId, attempt]);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((current) => current + 1);
  }, []);

  const record = useCallback(
    (candidateUserId: number, decision: NonNullable<ApplicantDecision>) => {
      setDecisions((current) => new Map(current).set(candidateUserId, decision));
    },
    [],
  );

  const like = useCallback(
    async (candidateUserId: number): Promise<LikeResultDto> => {
      setPendingId(candidateUserId);
      try {
        const response = await offerControllerLikeApplicant(offerId, candidateUserId);
        record(candidateUserId, { kind: 'liked', at: new Date().toISOString() });
        return response.data;
      } finally {
        setPendingId(null);
      }
    },
    [offerId, record],
  );

  const pass = useCallback(
    async (candidateUserId: number): Promise<void> => {
      setPendingId(candidateUserId);
      try {
        await offerControllerPassApplicant(offerId, candidateUserId);
        record(candidateUserId, { kind: 'passed', at: new Date().toISOString() });
      } finally {
        setPendingId(null);
      }
    },
    [offerId, record],
  );

  const decisionFor = useCallback(
    (candidateUserId: number): ApplicantDecision => decisions.get(candidateUserId) ?? null,
    [decisions],
  );

  return { applicants, status, truncated, pendingId, reload, like, pass, decisionFor };
}
