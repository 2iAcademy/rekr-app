import { useCallback, useEffect, useState } from 'react';
import { jobFamilyControllerFindAll, type JobFamilyDto } from '@/api/generated';

type JobFamiliesStatus = 'loading' | 'ready' | 'failed';

interface UseJobFamilies {
  jobFamilies: JobFamilyDto[];
  status: JobFamiliesStatus;
  reload: () => void;
}

/**
 * Same reason as `useSectors`: the API orders by label, but Postgres sorts on
 * its own collation and files accented initials after `Z` — `Éducation` and
 * `Énergie` would land below `Sécurité`, where nobody looking under `E` will
 * find them.
 */
const byFrenchLabel = new Intl.Collator('fr').compare;

/**
 * Reference data shared by both sides of the match: the recruiter names one
 * family per offer, the candidate names the ones they are looking for. Lives
 * outside either feature because neither owns it.
 *
 * A failure is surfaced with a way back rather than swallowed. On the offer
 * form the family is required, so an empty list would leave the recruiter
 * unable to publish at all.
 */
export function useJobFamilies(): UseJobFamilies {
  const [jobFamilies, setJobFamilies] = useState<JobFamilyDto[]>([]);
  const [status, setStatus] = useState<JobFamiliesStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void jobFamilyControllerFindAll()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setJobFamilies(
          [...response.data].sort((left, right) => byFrenchLabel(left.label, right.label)),
        );
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

  return { jobFamilies, status, reload };
}
