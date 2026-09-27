import { cn } from '@/lib/utils';

export interface Fact {
  label: string;
  value: string;
}

interface FactListProps {
  facts: readonly Fact[];
  /**
   * `open` frames the list with a rule above and below, for a list that sits
   * in the middle of a card's content; `closed` drops the rule under the last
   * row, for a list that fills a card section on its own.
   */
  edges?: 'open' | 'closed';
  className?: string;
}

/**
 * The facts that decide a yes or a no, as aligned label/value rows split by
 * hairlines: two lists read the same way, and a missing value stands out
 * instead of hiding in a sentence.
 */
export function FactList({ facts, edges = 'closed', className }: FactListProps) {
  return (
    <dl className={cn('text-sm', edges === 'open' && 'border-t border-line', className)}>
      {facts.map((fact) => (
        <div
          key={fact.label}
          className={cn(
            'flex items-baseline justify-between gap-4 border-b border-line py-2.5',
            edges === 'closed' && 'last:border-b-0',
          )}
        >
          <dt className="shrink-0 text-ink-muted">{fact.label}</dt>
          <dd className="tabular text-right font-bold break-words text-ink">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
