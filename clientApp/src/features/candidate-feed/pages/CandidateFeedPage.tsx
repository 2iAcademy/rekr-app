import { useCallback, useRef, useState } from 'react';
import { CircleAlert, RotateCcw } from 'lucide-react';
import { offerControllerLike, offerControllerPass } from '@/api/generated';
import { notifyFailure } from '@/lib/feedback/notify';
import { likeFailureBusiness } from '../likeFeedback';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button-variants';
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
import { matchedCompany } from '@/features/matches/likeResult';

const SWIPE_THRESHOLD = 120;

interface CandidateFeedPageProps {
  onOpenOffer: (id: number) => void;
  onMatch: (matchedProfile: { name: string; avatarUrl: string | null }) => void;
}

export function CandidateFeedPage({ onOpenOffer, onMatch }: CandidateFeedPageProps) {
  const { offers, status, reload } = useOfferFeed();
  const [decisions, setDecisions] = useState(noDecisions);
  const deckRef = useRef<HTMLElement>(null);

  // No client-side filter left: the endpoint shapes the deck from the profile,
  // so everything that arrives belongs in it.
  const deck = remainingItems(offers, decisions, () => true);
  const [current] = deck;
  const liked = likedCount(decisions);
  // Answered offers leave `deck` but stay in `offers`, so the gap is how far in we are.
  const position = offers.length - deck.length + 1;

  /**
   * « Vous avez tout vu » est faux sur un deck vide à l'arrivée : le candidat n'a
   * rien vu du tout, ses critères n'ont simplement rien laissé passer. Aucune
   * décision prise sur un paquet vide, c'est exactement ce cas.
   */
  const untouched = Object.keys(decisions).length === 0;
  const deckEndTitle =
    offers.length === 0 && untouched
      ? 'Aucune offre ne correspond à vos critères'
      : 'Vous avez tout vu';

  /**
   * The card leaves the deck the moment it is answered, before the server has
   * agreed. That is deliberate: a swipe that waited on the network would stall
   * the deck, and a like nobody sees fail is a worse outcome than a like that
   * silently has to be redone. The failure is surfaced as a toast, and the
   * endpoint is idempotent, so liking the same offer again is harmless.
   *
   * Both decisions are persisted through their idempotent endpoints.
   */
  const decide = useCallback(
    (decision: Decision, offer: OfferFeedItemDto | undefined = current): void => {
      if (!offer) {
        return;
      }

      setDecisions((previous) => recordDecision(previous, offer.id, decision));

      if (decision === 'passed') {
        void offerControllerPass(offer.id).catch((cause: unknown) =>
          notifyFailure(cause, likeFailureBusiness),
        );
      }

      if (decision === 'liked') {
        void offerControllerLike(offer.id)
          .then((response) => {
            const counterpart = matchedCompany(response.data);
            if (counterpart) onMatch({ name: counterpart.name, avatarUrl: counterpart.avatarUrl });
          })
          .catch((cause: unknown) => notifyFailure(cause, likeFailureBusiness));
      }

      if (deck.length === 1) {
        deckRef.current?.focus();
      }
    },
    [current, deck.length, onMatch],
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
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col gap-4 md:mt-0">
      <h1 className="sr-only">Offres</h1>

      {status === 'loading' && (
        <div className="flex flex-col gap-4">
          <p role="status" className="sr-only">
            Chargement…
          </p>
          <div
            aria-hidden="true"
            className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6"
          >
            <div className="flex items-center gap-3">
              <div className="size-12 shrink-0 animate-pulse rounded-full bg-surface" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-3.5 w-2/5 animate-pulse rounded-xl bg-surface" />
                <div className="h-3 w-1/4 animate-pulse rounded-xl bg-surface" />
              </div>
            </div>
            <div className="h-6 w-4/5 animate-pulse rounded-xl bg-surface" />
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-4 animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
            <div className="h-10 animate-pulse rounded-xl bg-surface" />
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col items-center rounded-2xl border border-line bg-card px-6 py-10 text-center shadow-card">
          <span className="flex size-14 items-center justify-center rounded-full bg-destructive-tint text-destructive">
            <CircleAlert className="size-6" aria-hidden="true" />
          </span>
          <p role="alert" className="mt-4 text-[0.9375rem] font-bold text-ink">
            Impossible de charger les offres.
          </p>
          <p className="mt-1 text-sm text-ink-muted">Vérifiez votre connexion, puis réessayez.</p>
          <button
            type="button"
            onClick={reload}
            className={cn(buttonVariants({ variant: 'outline', size: 'xl' }), 'mt-5')}
          >
            <RotateCcw aria-hidden="true" />
            Réessayer
          </button>
        </div>
      )}

      <section
        ref={deckRef}
        tabIndex={-1}
        aria-label="Offres à parcourir"
        className="flex flex-1 flex-col gap-5 outline-none"
      >
        {/* Announced only once the answer is in: `offers` starts empty, so
            saying « vous avez tout vu » before that — or on a failed load, next to
            the alert that says the opposite — would be a lie read aloud. */}
        {status === 'ready' && (
          <p role="status" className="sr-only">
            {current ? `Offre ${current.title} chez ${current.company.name}` : deckEndTitle}
          </p>
        )}

        {current ? (
          <>
            <p className="tabular -mb-2 self-end text-xs font-semibold text-ink-muted">
              {`Offre ${position} sur ${offers.length}`}
            </p>
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
            <div className="sticky bottom-[var(--tabbar-h,0px)] z-10 mt-auto bg-background pt-3 pb-4">
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
              title={deckEndTitle}
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
