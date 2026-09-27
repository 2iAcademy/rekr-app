import { useId } from 'react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
}

/** Rekr mark: two outlined discs, the candidate and the company; only their overlap — the match — is filled. */
export function BrandMark({ className }: BrandMarkProps) {
  const clip = `mark-lens-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 132 80" className={cn('h-auto', className)} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <circle cx="44" cy="40" r="34" />
        </clipPath>
      </defs>
      <circle cx="88" cy="40" r="34" className="fill-brand" clipPath={`url(#${clip})`} />
      <circle cx="44" cy="40" r="34" fill="none" strokeWidth="8" className="stroke-current" />
      <circle cx="88" cy="40" r="34" fill="none" strokeWidth="8" className="stroke-current" />
    </svg>
  );
}
