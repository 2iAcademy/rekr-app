import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// The rubric above a block of profile or offer detail. Shared so the candidate
// side and the recruiter side cannot drift into two typographies.
function SectionTitle({
  className,
  level = 3,
  ...props
}: ComponentProps<'h3'> & { level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <Heading
      data-slot="section-title"
      className={cn('text-base font-extrabold text-ink', className)}
      {...props}
    />
  );
}

export { SectionTitle };
