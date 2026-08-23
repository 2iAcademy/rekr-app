import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// The rubric above a block of profile or offer detail. Shared so the candidate
// side and the recruiter side cannot drift into two typographies.
function SectionTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="section-title"
      className={cn('text-xs font-semibold tracking-wider text-ink-muted uppercase', className)}
      {...props}
    />
  );
}

export { SectionTitle };
