import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { EmptyDeck } from '@/components/feed/EmptyDeck';
import { FeedActions } from '@/components/feed/FeedActions';
import { SwipeHint } from '@/components/feed/SwipeHint';
import {
  emptyReason,
  likedCount,
  noDecisions,
  recordDecision,
  remainingItems,
  type Decision,
} from '@/components/feed/deck';
import { useCardSwipe } from '@/hooks/useCardSwipe';
import { useDeckKeyboard } from '@/hooks/useDeckKeyboard';
import { matchesOfferFilters } from '../filters';
import { likedOfferCountLabel, offerDeckTitle } from '../labels';
import { mockFeedOffers } from '../mocks';
import type { FeedOffer } from '../types';
import { emptyOfferFeedFilters, type OfferFeedFilters } from '../types';
import { OfferCard } from '../components/OfferCard';
import { OfferFilterBar } from '../components/OfferFilterBar';

const SWIPE_THRESHOLD = 120;

interface CandidateFeedPageProps {
  offers?: readonly FeedOffer[];
  onOpenOffer: (id: number) => void;
}

export function CandidateFeedPage({
  offers = mockFeedOffers,
  onOpenOffer,
}: CandidateFeedPageProps) {
  const [filters, setFilters] = useState<OfferFeedFilters>(emptyOfferFeedFilters);
  const [decisions, setDecisions] = useState(noDecisions);
  const deckRef = useRef<HTMLElement>(null);

  const deck = remainingItems(offers, decisions, (offer) => matchesOfferFilters(offer, filters));
  const [current] = deck;
  const liked = likedCount(decisions);
  const reason = emptyReason(offers, decisions);

  const decide = useCallback(
    (decision: Decision, offer: FeedOffer | undefined = current): void => {
      if (!offer) {
        return;
      }

      setDecisions((previous) => recordDecision(previous, offer.id, decision));

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

      <OfferFilterBar filters={filters} onChange={setFilters} resultCount={deck.length} />

      <section
        ref={deckRef}
        tabIndex={-1}
        aria-label="Offres à parcourir"
        className="flex flex-1 flex-col gap-5 outline-none"
      >
        <p role="status" className="sr-only">
          {current ? `Offre ${current.title} chez ${current.companyName}` : offerDeckTitle(reason)}
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
          <EmptyDeck
            reason={reason}
            title={offerDeckTitle(reason)}
            itemPlural="offres"
            likedCount={liked}
            likedLabel={likedOfferCountLabel}
            onResetFilters={() => setFilters(emptyOfferFeedFilters)}
          />
        )}
      </section>
    </div>
  );
}
