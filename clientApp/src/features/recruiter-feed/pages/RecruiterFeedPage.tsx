import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CandidateCard } from '../components/CandidateCard';
import { EmptyDeck } from '../components/EmptyDeck';
import { FeedActions } from '../components/FeedActions';
import { FeedFilterBar } from '../components/FeedFilterBar';
import { SwipeHint } from '../components/SwipeHint';
import {
  emptyReason,
  likedCount,
  noDecisions,
  recordDecision,
  remainingCandidates,
  type Decision,
} from '../deck';
import { emptyDeckTitle, nameWithAge } from '../labels';
import { mockFeedCandidates } from '../mocks';
import { useCardSwipe } from '../useCardSwipe';
import { emptyFeedFilters, type FeedCandidate, type FeedFilters } from '../types';
import { CandidateDetailPage } from './CandidateDetailPage';

// Shared by the gesture and by the band that previews its outcome, so the
// colour reaches full strength exactly where the decision tips over.
const SWIPE_THRESHOLD = 120;

interface RecruiterFeedPageProps {
  candidates?: readonly FeedCandidate[];
  // Which profile the URL asks for, already parsed by the route. Required, and
  // deliberately not defaulted to a no-op: a silent default would let a wiring
  // regression through without a single red test.
  openCandidateId: number | null;
  onOpenProfile: (id: number) => void;
  onCloseProfile: () => void;
}

/**
 * Recruiter deck. The candidates come from `mocks.ts` because no endpoint lists
 * swipeable profiles yet (#135); the prop is what lets the tests drive a short,
 * explicit deck.
 *
 * The detail screen (#136) is one of this page's states rather than a route of
 * its own, so the deck survives it: the route only turns `?profil=<id>` into the
 * three props above.
 *
 * Both states are rendered inside `AppDrawer`, which owns the `main` landmark,
 * the `data-role` palette and the page padding. Neither carries a visible page
 * header of its own: the maquette's top bar and side navigation are the shell's,
 * and the violet banner it does show belongs to the candidate card. The screen
 * reader heading below keeps the document outline intact.
 */
export function RecruiterFeedPage({
  candidates = mockFeedCandidates,
  openCandidateId,
  onOpenProfile,
  onCloseProfile,
}: RecruiterFeedPageProps) {
  const [filters, setFilters] = useState<FeedFilters>(emptyFeedFilters);
  const [decisions, setDecisions] = useState(noDecisions);
  const deckRef = useRef<HTMLElement>(null);
  const wasDetailOpen = useRef(false);

  const deck = remainingCandidates(candidates, decisions, filters);
  const [current] = deck;
  const liked = likedCount(decisions);
  const reason = emptyReason(candidates, decisions);

  // Looked up in the whole list, not in the remaining deck: a decided or
  // filtered-out profile is no longer in the deck, and a deep link to one must
  // show the profile rather than an empty screen.
  const openCandidate = candidates.find(({ id }) => id === openCandidateId) ?? null;
  const isDetailOpen = openCandidate !== null;

  const decide = useCallback(
    (decision: Decision, candidate: FeedCandidate | undefined = current): void => {
      if (!candidate) {
        return;
      }

      setDecisions((previous) => recordDecision(previous, candidate.id, decision));

      // The card being decided is the last one, so it is about to be replaced
      // by the empty state, which holds nothing focusable: without this the
      // focus falls back to the document body. A no-op while the detail screen
      // is up, since the deck is unmounted — the effect below covers that case.
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

  // An identifier pointing at nobody would otherwise leave the URL claiming a
  // screen the recruiter cannot see.
  useEffect(() => {
    if (openCandidateId !== null && openCandidate === null) {
      onCloseProfile();
    }
  }, [openCandidate, openCandidateId, onCloseProfile]);

  /**
   * Closing the detail screen unmounts the button that was clicked, and the deck
   * that replaces it only mounts on this render: the focus is restored here
   * rather than in the handler, otherwise it falls back to the document body.
   */
  useEffect(() => {
    if (wasDetailOpen.current && !isDetailOpen) {
      deckRef.current?.focus();
    }

    wasDetailOpen.current = isDetailOpen;
  }, [isDetailOpen]);

  /**
   * Arrow keys are bound on the window so the shortcut works without tabbing
   * into the deck first. They only fire while no control holds the focus,
   * otherwise a recruiter walking the filter chips would decide a profile
   * without seeing it.
   *
   * They are disarmed entirely while the detail screen is up: the deck is
   * unmounted there, so the guard below would read the focus as idle and decide
   * the head of the deck — which is not necessarily the profile on screen.
   */
  useEffect(() => {
    if (isDetailOpen) {
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
        decide('passed');
      }

      if (event.key === 'ArrowRight') {
        decide('liked');
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [decide, isDetailOpen]);

  if (openCandidate !== null) {
    const decideAndClose = (decision: Decision): void => {
      decide(decision, openCandidate);
      onCloseProfile();
    };

    return (
      <CandidateDetailPage
        candidate={openCandidate}
        onBack={onCloseProfile}
        onPass={() => decideAndClose('passed')}
        onLike={() => decideAndClose('liked')}
      />
    );
  }

  return (
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col gap-4 md:mx-0 md:mt-0">
      <h1 className="sr-only">Candidats</h1>

      <FeedFilterBar filters={filters} onChange={setFilters} resultCount={deck.length} />

      <section
        ref={deckRef}
        tabIndex={-1}
        aria-label="Profils à parcourir"
        className="flex flex-1 flex-col gap-5 outline-none"
      >
        <p role="status" className="sr-only">
          {current ? `Profil de ${nameWithAge(current)}` : emptyDeckTitle(reason)}
        </p>

        {current ? (
          <>
            {/* `touch-pan-y` leaves the vertical scroll to the browser while the
                horizontal drag stays ours; without it a phone confiscates the
                gesture before the first `pointermove`. */}
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
              <CandidateCard candidate={current} onViewProfile={() => onOpenProfile(current.id)} />
              <SwipeHint offset={swipe.offset} threshold={SWIPE_THRESHOLD} />
            </div>
            {/* Pinned: the card alone is taller than a phone viewport, so the
                two decisions would otherwise sit below the fold on the one
                screen whose whole point is deciding. The fade is what keeps the
                card readable underneath, since the maquette puts the buttons
                straight on the background with no bar. */}
            <div className="sticky bottom-0 z-10 mt-auto bg-gradient-to-t from-background from-40% via-background/85 to-transparent pt-8 pb-4">
              <FeedActions onPass={() => decide('passed')} onLike={() => decide('liked')} />
            </div>
            <p className="sr-only">
              Flèche gauche pour passer le profil, flèche droite pour le liker. La carte peut aussi
              être glissée vers la droite pour liker, vers la gauche pour passer.
            </p>
          </>
        ) : (
          <EmptyDeck
            reason={reason}
            likedCount={liked}
            onResetFilters={() => setFilters(emptyFeedFilters)}
          />
        )}
      </section>
    </div>
  );
}
