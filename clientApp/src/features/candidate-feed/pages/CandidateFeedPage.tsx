import { useCallback, useRef, useState } from 'react';
import { offerControllerLike } from '@/api/generated';
import { notifyFailure } from '@/lib/feedback/notify';
import { likeFailureBusiness } from '../likeFeedback';
import { cn } from '@/lib/utils';
import { EmptyDeck } from '@/components/feed/EmptyDeck';
import { FeedActions } from '@/components/feed/FeedActions';
import { SwipeHint } from '@/components/feed/SwipeHint';
import {
  likedCount,
  noDecisions,
  recordDecision,
  remainingItems,
  type Decision,
} from '@/components/feed/deck';
import { useCardSwipe } from '@/hooks/useCardSwipe';
import { useDeckKeyboard } from '@/hooks/useDeckKeyboard';
import type { OfferFeedItemDto } from '@/api/generated';
import { likedOfferCountLabel } from '../labels';
import { useOfferFeed } from '../useOfferFeed';
import { OfferCard } from '../components/OfferCard';

const SWIPE_THRESHOLD = 120;

interface CandidateFeedPageProps {
  onOpenOffer: (id: number) => void;
}

export function CandidateFeedPage({ onOpenOffer }: CandidateFeedPageProps) {
  const { offers, status, reload } = useOfferFeed();
  const [decisions, setDecisions] = useState(noDecisions);
  const deckRef = useRef<HTMLElement>(null);

  // No client-side filter left: the endpoint shapes the deck from the profile,
  // so everything that arrives belongs in it.
  const deck = remainingItems(offers, decisions, () => true);
  const [current] = deck;
  const liked = likedCount(decisions);

  /**
   * The card leaves the deck the moment it is answered, before the server has
   * agreed. That is deliberate: a swipe that waited on the network would stall
   * the deck, and a like nobody sees fail is a worse outcome than a like that
   * silently has to be redone. The failure is surfaced as a toast, and the
   * endpoint is idempotent, so liking the same offer again is harmless.
   *
   * Only a like is written: nothing stores a pass in this scope.
   */
  const decide = useCallback(
    (decision: Decision, offer: OfferFeedItemDto | undefined = current): void => {
      if (!offer) {
        return;
      }

      setDecisions((previous) => recordDecision(previous, offer.id, decision));

      if (decision === 'liked') {
        void offerControllerLike(offer.id).catch((cause: unknown) =>
          notifyFailure(cause, likeFailureBusiness),
        );
      }

      if (deck.length === 1) {
        deckRef.current?.focus();
      }
    },
    [current, deck.length],
  );

  const swipe = useCardSwipe({
    onSwipeRight: () => decide('liked'),
    onSwipeLeft: () => decide('passed'),
    threshold: SWIPE_THRESHOLD,
    disabled: !current,
  });

  useDeckKeyboard({
    deckRef,
    onDecision: decide,
    disabled: !current,
  });

  return (
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col gap-4 md:mx-0 md:mt-0">
      <h1 className="sr-only">Offres</h1>

      {status === 'loading' && <p className="text-sm text-ink-muted">Chargement…</p>}

      {status === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          Impossible de charger les offres.{' '}
          <button type="button" onClick={reload} className="cursor-pointer underline">
            Réessayer
          </button>
        </p>
      )}

      <section
        ref={deckRef}
        tabIndex={-1}
        aria-label="Offres à parcourir"
        className="flex flex-1 flex-col gap-5 outline-none"
      >
        <p role="status" className="sr-only">
          {current ? `Offre ${current.title} chez ${current.company.name}` : 'Tu as tout vu'}
        </p>

        {current ? (
          <>
            <div
              {...swipe.handlers}
              className={cn(
                'relative touch-pan-y',
                swipe.isDragging && 'cursor-grabbing select-none',
              )}
              style={{
                transform:
                  swipe.offset === 0
                    ? undefined
                    : `translateX(${swipe.offset}px) rotate(${swipe.offset / 30}deg)`,
                transition: swipe.isDragging ? undefined : 'transform 200ms ease-out',
              }}
            >
              <OfferCard offer={current} onViewOffer={() => onOpenOffer(current.id)} />
              <SwipeHint offset={swipe.offset} threshold={SWIPE_THRESHOLD} />
            </div>
            <div className="sticky bottom-0 z-10 mt-auto bg-gradient-to-t from-background from-40% via-background/85 to-transparent pt-8 pb-4">
              <FeedActions
                subject="offre"
                onPass={() => decide('passed')}
                onLike={() => decide('liked')}
              />
            </div>
            <p className="sr-only">
              Flèche gauche pour passer l'offre, flèche droite pour la liker. La carte peut aussi
              être glissée vers la droite pour liker, vers la gauche pour passer.
            </p>
          </>
        ) : (
          status === 'ready' && (
            <EmptyDeck
              title="Tu as tout vu"
              itemPlural="offres"
              likedCount={liked}
              likedLabel={likedOfferCountLabel}
            />
          )
        )}
      </section>
    </div>
  );
}
