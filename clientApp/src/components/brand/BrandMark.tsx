import { useId } from 'react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
}

/** Rekr mark: candidate (green) and company (violet) discs overlap; the intersection (the match) is coral. */
export function BrandMark({ className }: BrandMarkProps) {
  const clip = `mark-lens-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 132 80" className={cn('h-auto', className)} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <circle cx="40" cy="40" r="40" />
        </clipPath>
      </defs>
      <circle cx="40" cy="40" r="40" className="fill-brand" />
      <circle cx="92" cy="40" r="40" className="fill-violet" />
      <circle cx="92" cy="40" r="40" className="fill-coral" clipPath={`url(#${clip})`} />
    </svg>
  );
}
