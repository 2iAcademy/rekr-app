import { useCallback, useEffect, useState } from 'react';
import { sectorControllerFindAll, type SectorDto } from '@/api/generated';

type SectorsStatus = 'loading' | 'ready' | 'failed';

interface UseSectors {
  sectors: SectorDto[];
  status: SectorsStatus;
  reload: () => void;
}

/**
 * The API orders by label, but Postgres sorts on its own collation and files
 * accented initials after `Z`: `Éducation` and `Énergie` land below `Transport`,
 * where nobody looking under `E` will find them. Ordering for a French reader is
 * a presentation concern, so it happens here.
 */
const byFrenchLabel = new Intl.Collator('fr').compare;

/**
 * Reference data, fetched by the field that displays it rather than threaded
 * through every step's props. A failure is surfaced with a way back rather than
 * swallowed: the sector is required, so an empty list would otherwise leave the
 * recruiter unable to leave the step.
 */
export function useSectors(): UseSectors {
  const [sectors, setSectors] = useState<SectorDto[]>([]);
  const [status, setStatus] = useState<SectorsStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void sectorControllerFindAll()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setSectors(
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

  return { sectors, status, reload };
}
