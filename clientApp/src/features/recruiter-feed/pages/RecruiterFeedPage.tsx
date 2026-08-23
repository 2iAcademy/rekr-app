import { useCallback, useEffect, useId, useRef, useState } from 'react';
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

// Shared by the gesture and by the band that previews its outcome, so the
// colour reaches full strength exactly where the decision tips over.
const SWIPE_THRESHOLD = 120;

interface RecruiterFeedPageProps {
  candidates?: readonly FeedCandidate[];
}

/**
 * Recruiter deck. The candidates come from `mocks.ts` because no endpoint lists
 * swipeable profiles yet (#135); the prop is what lets the tests drive a short,
 * explicit deck.
 *
 * Rendered inside `AppDrawer`, which owns the `main` landmark, the `data-role`
 * palette and the page padding. The screen therefore carries no visible header
 * of its own: the maquette's top bar and side navigation are the shell's, and
 * the violet banner it does show belongs to the candidate card. The screen
 * reader heading below keeps the document outline intact.
 */
export function RecruiterFeedPage({ candidates = mockFeedCandidates }: RecruiterFeedPageProps) {
  const [filters, setFilters] = useState<FeedFilters>(emptyFeedFilters);
  const [decisions, setDecisions] = useState(noDecisions);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profilePanelId = useId();
  const deckRef = useRef<HTMLElement>(null);

  const deck = remainingCandidates(candidates, decisions, filters);
  const [current] = deck;
  const liked = likedCount(decisions);
  const reason = emptyReason(candidates, decisions);

  const decide = useCallback(
    (decision: Decision): void => {
      if (!current) {
        return;
      }

      setDecisions((previous) => recordDecision(previous, current.id, decision));
      setIsProfileOpen(false);

      // The card being decided is the last one, so it is about to be replaced
      // by the empty state, which holds nothing focusable: without this the
      // focus falls back to the document body.
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

  // A filter can change which candidate is on top, and the panel is opened for
  // one candidate only: `decide` closes it for the same reason.
  const changeFilters = (next: FeedFilters): void => {
    setFilters(next);
    setIsProfileOpen(false);
  };

  /**
   * Arrow keys are bound on the window so the shortcut works without tabbing
   * into the deck first. They only fire while no control holds the focus,
   * otherwise a recruiter walking the filter chips would decide a profile
   * without seeing it.
   */
  useEffect(() => {
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
  }, [decide]);

  return (
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col gap-4 md:mx-0 md:mt-0">
      <h1 className="sr-only">Candidats</h1>

      <FeedFilterBar filters={filters} onChange={changeFilters} resultCount={deck.length} />

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
              <CandidateCard
                candidate={current}
                isProfileOpen={isProfileOpen}
                onToggleProfile={() => setIsProfileOpen((open) => !open)}
                profilePanelId={profilePanelId}
              />
              <SwipeHint offset={swipe.offset} threshold={SWIPE_THRESHOLD} />
            </div>
            {/* Pinned: the card alone is taller than a phone viewport, so the
                two decisions would otherwise sit below the fold on the one
                screen whose whole point is deciding. The fade is what keeps the
                unfolded profile readable underneath, since the maquette puts
                the buttons straight on the background with no bar. */}
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
            onResetFilters={() => changeFilters(emptyFeedFilters)}
          />
        )}
      </section>
    </div>
  );
}
