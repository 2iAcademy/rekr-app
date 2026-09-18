import { useEffect, type RefObject } from 'react';
import type { Decision } from '@/components/feed/deck';

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
      const focusIsIdle = target === document.body || target === document.documentElement;
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
