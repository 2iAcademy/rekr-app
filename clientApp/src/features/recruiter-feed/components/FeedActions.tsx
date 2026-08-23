import { Heart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedActionsProps {
  onPass: () => void;
  onLike: () => void;
}

const circle =
  'flex cursor-pointer items-center justify-center rounded-full transition-transform active:translate-y-px';

const caption = 'text-xs text-ink-muted';

/**
 * Both circles share one diameter: the maquette's 56/48/64 hierarchy only held
 * with the detail button between them, and the coral fill carries the emphasis
 * on its own.
 *
 * Each circle carries its name on `aria-label` and repeats it in lowercase
 * underneath, hidden from assistive tech: the visible word stays a substring of
 * the accessible name, so voice control still reaches the button (WCAG 2.5.3).
 *
 * There is no third circle for the detail: the card already exposes it through
 * `Voir le profil`, and two controls for one panel is one too many.
 */
export function FeedActions({ onPass, onLike }: FeedActionsProps) {
  return (
    <div
      role="group"
      aria-label="Décision sur le profil"
      className="flex items-center justify-center gap-10 sm:gap-12"
    >
      <span className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          aria-label="Passer"
          onClick={onPass}
          className={cn(circle, 'size-16 bg-card text-ink shadow-md hover:bg-muted')}
        >
          <X className="size-7" aria-hidden="true" />
        </button>
        <span aria-hidden="true" className={caption}>
          passer
        </span>
      </span>

      <span className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          aria-label="Liker"
          onClick={onLike}
          className={cn(
            circle,
            'size-16 bg-coral-gradient text-white shadow-coral hover:opacity-95',
          )}
        >
          <Heart className="size-7 fill-current" aria-hidden="true" />
        </button>
        <span aria-hidden="true" className={caption}>
          liker
        </span>
      </span>
    </div>
  );
}
