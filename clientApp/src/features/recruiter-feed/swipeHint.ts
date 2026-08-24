type SwipeDirection = 'like' | 'pass';

export const swipeDirection = (offset: number): SwipeDirection | null => {
  if (offset === 0) {
    return null;
  }

  return offset > 0 ? 'like' : 'pass';
};

/**
 * How far the gesture has travelled towards its decision, from 0 to 1. The band
 * fades in with it, so the recruiter reads the outcome before releasing rather
 * than after.
 */
export const swipeProgress = (offset: number, threshold: number): number =>
  Math.min(1, Math.abs(offset) / threshold);
