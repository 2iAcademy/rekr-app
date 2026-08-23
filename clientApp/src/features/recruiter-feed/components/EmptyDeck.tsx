import { SearchX, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EmptyReason } from '../deck';
import { emptyDeckTitle, likedCountLabel } from '../labels';

interface EmptyDeckProps {
  reason: EmptyReason;
  likedCount: number;
  onResetFilters: () => void;
}

/**
 * The two ends of a deck are not the same story: filters can be widened, an
 * exhausted deck cannot, so only `no-match` offers a way out. The maquette's
 * second `Plus tard` button is left out until there is a shell to send it to.
 */
export function EmptyDeck({ reason, likedCount, onResetFilters }: EmptyDeckProps) {
  const filtered = reason === 'no-match';
  const Icon = filtered ? SearchX : Sparkles;

  return (
    <section className="flex flex-col items-center gap-8 px-6 py-12 text-center">
      <span className="flex size-30 items-center justify-center rounded-full bg-role/10 text-role">
        <Icon className="size-10" aria-hidden="true" />
      </span>

      <div className="flex flex-col items-center gap-3">
        <h2 className="font-heading text-2xl font-bold text-ink">{emptyDeckTitle(reason)}</h2>

        <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
          {filtered
            ? 'Élargissez vos critères pour revoir des candidats.'
            : 'Revenez plus tard, de nouveaux candidats arrivent chaque jour.'}
        </p>
      </div>

      {filtered ? (
        <Button
          type="button"
          variant="role"
          size="xl"
          className="w-full max-w-xs"
          onClick={onResetFilters}
        >
          Élargir la recherche
        </Button>
      ) : (
        <p className="text-sm font-semibold text-role">{likedCountLabel(likedCount)}</p>
      )}
    </section>
  );
}
