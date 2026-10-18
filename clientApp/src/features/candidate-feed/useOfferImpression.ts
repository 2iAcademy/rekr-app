import { useEffect, useRef, type RefObject } from 'react';
import { customFetch } from '@/api/customFetch';

/** Optional local analytics: active card >=50% visible in a visible tab. */
export function useOfferImpression(
  ref: RefObject<HTMLDivElement | null>,
  offerId: number | undefined,
  position: number,
): void {
  const sent = useRef(new Set<number>());
  useEffect(() => {
    const node = ref.current;
    if (
      import.meta.env.VITE_DATA_ANALYTICS_ENABLED !== 'true' ||
      !node ||
      !offerId ||
      sent.current.has(offerId) ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    let visible = false;
    const report = (): void => {
      if (!visible || document.visibilityState !== 'visible' || sent.current.has(offerId)) return;
      sent.current.add(offerId);
      // Analytics must never interrupt swiping or display a business-error toast.
      void customFetch(`/api/data/offers/${offerId}/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
      }).catch(() => undefined);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        report();
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    document.addEventListener('visibilitychange', report);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', report);
    };
  }, [ref, offerId, position]);
}
