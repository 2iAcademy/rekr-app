import { useEffect, type RefObject } from 'react';
import type { Decision } from '@/components/feed/deck';
import { MAIN_CONTENT_ID } from '@/components/layout/mainContent';

interface UseDeckKeyboardOptions {
  deckRef: RefObject<HTMLElement | null>;
  onDecision: (decision: Decision) => void;
  disabled?: boolean;
}

/**
 * Lets a deck be decided with arrow keys only when focus is idle or inside it,
 * never while a filter or another control is active.
 */
export function useDeckKeyboard({
  deckRef,
  onDecision,
  disabled = false,
}: UseDeckKeyboardOptions): void {
  useEffect(() => {
    if (disabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;
      // The skip link makes `main` focusable, so a click on any empty spot of
      // the page lands there: that is still a focus at rest, not a control.
      const focusIsIdle =
        target === document.body ||
        target === document.documentElement ||
        (target instanceof HTMLElement && target.id === MAIN_CONTENT_ID);
      const focusIsInDeck = target instanceof Node && deckRef.current?.contains(target) === true;

      if (!focusIsIdle && !focusIsInDeck) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        onDecision('passed');
      }

      if (event.key === 'ArrowRight') {
        onDecision('liked');
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deckRef, disabled, onDecision]);
}
