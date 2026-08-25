import { Heart, X } from 'lucide-react';
import { swipeDirection, swipeProgress } from './swipeGesture';

interface SwipeHintProps {
  offset: number;
  threshold: number;
}

/**
 * Colour laid over the dragged card: green for a like, red for a pass, fading in
 * with the distance travelled so the outcome is read before the release.
 *
 * It covers the whole card rather than sitting as a strip along its edge: on a
 * phone the card spans nearly the full width, so an edge strip leaves the screen
 * the moment the card moves. The wash and the badge are two layers because
 * `opacity` applies to children: nested, the badge could never be crisper than
 * the wash behind it. Decorative only, the deck's live region is what announces
 * the outcome to assistive tech.
 */
export const SwipeHint = ({ offset, threshold }: SwipeHintProps) => {
  const direction = swipeDirection(offset);

  if (direction === null) {
    return null;
  }

  const progress = swipeProgress(offset, threshold);
  const isLike = direction === 'like';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div
        className={`absolute inset-0 rounded-3xl ${isLike ? 'bg-brand' : 'bg-destructive'}`}
        style={{ opacity: progress * 0.5 }}
      />
      <span
        className="relative flex size-24 items-center justify-center rounded-full bg-white shadow-lg"
        style={{ opacity: progress }}
      >
        {isLike ? (
          <Heart className="size-12 fill-brand text-brand" />
        ) : (
          <X className="size-12 text-destructive" strokeWidth={3} />
        )}
      </span>
    </div>
  );
};
