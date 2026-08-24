import { SearchX, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyDeckProps {
  reason: 'no-match' | 'exhausted';
  title: string;
  itemPlural: string;
  likedCount: number;
  likedLabel: (count: number) => string;
  onResetFilters: () => void;
}

/** Shared empty-state layout; each feed owns its domain wording and counts. */
export const EmptyDeck = ({
  reason,
  title,
  itemPlural,
  likedCount,
  likedLabel,
  onResetFilters,
}: EmptyDeckProps) => {
  const filtered = reason === 'no-match';
  const Icon = filtered ? SearchX : Sparkles;

  return (
    <section className="flex flex-col items-center gap-8 px-6 py-12 text-center">
      <span className="flex size-30 items-center justify-center rounded-full bg-role/10 text-role">
        <Icon className="size-10" aria-hidden="true" />
      </span>

      <div className="flex flex-col items-center gap-3">
        <h2 className="font-heading text-2xl font-bold text-ink">{title}</h2>

        <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
          {filtered
            ? `Élargissez vos critères pour revoir des ${itemPlural}.`
            : `Revenez plus tard, de nouvelles ${itemPlural} arrivent chaque jour.`}
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
        <p className="text-sm font-semibold text-role">{likedLabel(likedCount)}</p>
      )}
    </section>
  );
};
