import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const DEFAULT_THRESHOLD = 120;

// A tap on the card's `Voir le profil` button or its LinkedIn link must stay a
// tap, and a pointer never travels exactly zero pixel: nothing moves below this
// distance, so a clumsy click is still a click.
const DRAG_START_DISTANCE = 8;

// Past this distance the dominant axis is settled. A mostly vertical move is the
// recruiter scrolling the page on a phone, so the gesture steps aside rather
// than swallowing the scroll.
const DIRECTION_LOCK_DISTANCE = 10;

const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [contenteditable]';

const GESTURE_EVENTS = ['pointermove', 'pointerup', 'pointercancel'] as const;

interface CardSwipeOptions {
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  threshold?: number;
  disabled?: boolean;
}

interface CardSwipe {
  offset: number;
  isDragging: boolean;
  handlers: {
    onPointerDown: (event: ReactPointerEvent) => void;
  };
}

/**
 * Horizontal drag over the feed card: right likes, left passes. It only carries
 * the gesture — the buttons and the keyboard shortcuts call the same callbacks.
 *
 * The move and release listeners go on `window` rather than through
 * `setPointerCapture`: a gesture has to survive the pointer leaving the card,
 * and jsdom implements no pointer capture at all, which would make the whole
 * mechanism untestable.
 */
export function useCardSwipe({
  onSwipeRight,
  onSwipeLeft,
  threshold = DEFAULT_THRESHOLD,
  disabled = false,
}: CardSwipeOptions): CardSwipe {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const endGestureRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      endGestureRef.current?.();
    },
    [],
  );

  const onPointerDown = (event: ReactPointerEvent): void => {
    // A gesture already running means a second finger landed: only the first one
    // drives the card.
    if (disabled || event.button !== 0 || endGestureRef.current) {
      return;
    }

    const origin = event.target;

    if (origin instanceof Element && origin.closest(INTERACTIVE_SELECTOR) !== null) {
      return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const { pointerId } = event;

    let travelled = 0;
    let hasStarted = false;

    const endGesture = (): void => {
      // Releasing the listeners is also what makes a gesture decide only once: a
      // `pointercancel` following a `pointerup` no longer reaches us.
      for (const type of GESTURE_EVENTS) {
        window.removeEventListener(type, onGestureEvent);
      }

      endGestureRef.current = null;
      setOffset(0);
      setIsDragging(false);
    };

    const track = (gestureEvent: PointerEvent): void => {
      const horizontal = gestureEvent.clientX - startX;
      const vertical = gestureEvent.clientY - startY;

      if (!hasStarted) {
        if (
          Math.abs(vertical) > DIRECTION_LOCK_DISTANCE &&
          Math.abs(vertical) > Math.abs(horizontal)
        ) {
          endGesture();
          return;
        }

        if (Math.abs(horizontal) <= DRAG_START_DISTANCE) {
          return;
        }

        hasStarted = true;
        setIsDragging(true);
      }

      travelled = horizontal;
      setOffset(travelled);
    };

    const release = (): void => {
      const distance = hasStarted ? travelled : 0;

      endGesture();

      if (distance > threshold) {
        onSwipeRight();
        return;
      }

      if (distance < -threshold) {
        onSwipeLeft();
      }
    };

    const onGestureEvent = (gestureEvent: Event): void => {
      if (!(gestureEvent instanceof PointerEvent) || gestureEvent.pointerId !== pointerId) {
        return;
      }

      if (gestureEvent.type === 'pointermove') {
        track(gestureEvent);
        return;
      }

      if (gestureEvent.type === 'pointerup') {
        release();
        return;
      }

      endGesture();
    };

    for (const type of GESTURE_EVENTS) {
      window.addEventListener(type, onGestureEvent);
    }

    endGestureRef.current = endGesture;
  };

  return { offset, isDragging, handlers: { onPointerDown } };
}
