import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
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
import { matchedCompany, type MatchedProfile } from '@/features/matches/likeResult';

const SWIPE_THRESHOLD = 120;

// Enough to cover a fast run of answers. Under reduced motion no animation ends
// to remove a card, so the bound is what keeps the hidden ones from piling up.
const MAX_LEAVING_CARDS = 3;

/** The last answer, as the line above the deck words it. */
interface Outcome {
  offerId: number;
  title: string;
  decision: Decision;
  failed: boolean;
}

/** An answered card on its way out, drawn over the next one. */
interface LeavingCard {
  key: number;
  offer: OfferFeedItemDto;
  decision: Decision;
  from: number;
}

function outcomeText({ title, decision, failed }: Outcome): string {
  if (failed) {
    return decision === 'liked'
      ? `Like non enregistré : ${title}`
      : `Passage non enregistré : ${title}`;
  }

  return decision === 'liked' ? `Liké : ${title}` : `Passé : ${title}`;
}

/**
 * One answered card leaving the screen with its stamp, gone once its animation
 * ends. The native `animationend` is listened to directly: React maps the prop
 * to a vendor-prefixed name wherever `AnimationEvent` is missing, and only the
 * card's own animation counts, not one bubbling up from inside it.
 */
function LeavingOfferCard({
  card: { offer, decision, from },
  onGone,
}: {
  card: LeavingCard;
  onGone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const side = decision === 'liked' ? 'right' : 'left';

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const end = (event: Event): void => {
      if (event.target === node) onGone();
    };
    node.addEventListener('animationend', end);

    return () => node.removeEventListener('animationend', end);
  }, [onGone]);

  const style = {
    '--leave-from': `${from}px`,
    '--leave-tilt': `${from / 30}deg`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      inert
      data-leaving={side}
      style={style}
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 motion-reduce:hidden',
        side === 'right' ? 'animate-card-leave-right' : 'animate-card-leave-left',
      )}
    >
      <OfferCard offer={offer} onViewOffer={() => undefined} />
      <span
        className={cn(
          'absolute top-6 rounded-lg border-2 bg-card px-3 py-1 text-lg font-extrabold uppercase',
          side === 'right'
            ? 'left-6 -rotate-12 border-success text-success'
            : 'right-6 rotate-12 border-ink-muted text-ink-muted',
        )}
      >
        {decision === 'liked' ? 'Liké' : 'Passé'}
      </span>
    </div>
  );
}

interface CandidateFeedPageProps {
  onOpenOffer: (id: number) => void;
  onMatch: (matchedProfile: MatchedProfile) => void;
}

export function CandidateFeedPage({ onOpenOffer, onMatch }: CandidateFeedPageProps) {
  const { offers, status, reload } = useOfferFeed();
  const [decisions, setDecisions] = useState(noDecisions);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [leaving, setLeaving] = useState<LeavingCard[]>([]);
  const leavingKey = useRef(0);
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
   *
   * The answer is confirmed at once, on the line above the deck and by the card
   * leaving towards its side; a failure then rewrites that line, so a like the
   * server refused never reads as one that went through.
   */
  const decide = useCallback(
    (decision: Decision, offer: OfferFeedItemDto | undefined = current, from = 0): void => {
      if (!offer) {
        return;
      }

      setDecisions((previous) => recordDecision(previous, offer.id, decision));
      setOutcome({ offerId: offer.id, title: offer.title, decision, failed: false });
      leavingKey.current += 1;
      const card: LeavingCard = { key: leavingKey.current, offer, decision, from };
      setLeaving((previous) => [...previous, card].slice(-MAX_LEAVING_CARDS));

      const fail = (cause: unknown): void => {
        notifyFailure(cause, likeFailureBusiness);
        setOutcome({ offerId: offer.id, title: offer.title, decision, failed: true });
      };

      if (decision === 'passed') {
        void offerControllerPass(offer.id).catch(fail);
      }

      if (decision === 'liked') {
        void offerControllerLike(offer.id)
          .then((response) => {
            const matched = matchedCompany(response.data);
            if (matched) onMatch(matched);
          })
          .catch(fail);
      }

      if (deck.length === 1) {
        deckRef.current?.focus();
      }
    },
    [current, deck.length, onMatch],
  );

  const swipe = useCardSwipe({
    onSwipeRight: (distance) => decide('liked', current, distance),
    onSwipeLeft: (distance) => decide('passed', current, distance),
    threshold: SWIPE_THRESHOLD,
    disabled: !current,
  });

  useDeckKeyboard({
    deckRef,
    onDecision: decide,
    disabled: !current,
  });

  const forget = (key: number): void =>
    setLeaving((previous) => previous.filter((card) => card.key !== key));

  const leavingCards = (
    // Zero-height anchor: the cards on their way out sit over whatever comes
    // next — the following card or the end of the deck — without pushing it.
    <div className="relative z-20 h-0">
      {leaving.map((card) => (
        <LeavingOfferCard key={card.key} card={card} onGone={() => forget(card.key)} />
      ))}
    </div>
  );

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

        {status === 'ready' && (
          <div className="-mb-2 flex min-h-4 items-center justify-between gap-3">
            {/* Visible and announced: with reduced motion there is no card
                leaving, and this line is then the only confirmation. */}
            <p
              role="status"
              data-testid="decision-outcome"
              className={cn(
                'min-w-0 truncate text-xs font-semibold',
                outcome?.failed ? 'text-destructive' : 'text-ink-muted',
              )}
            >
              {outcome === null ? '' : outcomeText(outcome)}
            </p>
            {current && (
              <p className="tabular shrink-0 text-xs font-semibold text-ink-muted">
                {`Offre ${position} sur ${offers.length}`}
              </p>
            )}
          </div>
        )}

        {leavingCards}

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
