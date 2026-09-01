import { Heart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedActionsProps {
  onPass: () => void;
  onLike: () => void;
  subject?: 'profil' | 'offre';
}

const circle =
  'flex cursor-pointer items-center justify-center rounded-full transition-transform active:translate-y-px';

const caption = 'text-xs text-ink-muted';

export function FeedActions({ onPass, onLike, subject = 'profil' }: FeedActionsProps) {
  const groupLabel = subject === 'offre' ? "Décision sur l'offre" : 'Décision sur le profil';

  return (
    <div
      role="group"
      aria-label={groupLabel}
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
