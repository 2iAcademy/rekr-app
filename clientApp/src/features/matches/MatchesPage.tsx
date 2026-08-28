import { useEffect, useState } from 'react';
import {
  matchControllerFindMine,
  offerControllerFindLiked,
  type MatchListItemDto,
  type OfferFeedItemDto,
} from '@/api/generated';
import { fileUrl } from '@/lib/fileUrl';
import { cn, timeSince } from '@/lib/utils';

type MatchTab = 'matches' | 'likes';

interface MatchPreview {
  id: string;
  name: string;
  role: string;
  time: string;
  avatarClass: string;
  avatarUrl?: string | null;
  isNew?: boolean;
}

/**
 * The two tabs read two endpoints, so each carries its own wording: an empty
 * match list and an empty like list are not the same silence, and neither is a
 * failure to load one or the other.
 */
interface TabModel {
  value: MatchTab;
  label: string;
  empty: string;
  failure: string;
  listLabel: string;
}

const TABS: readonly TabModel[] = [
  {
    value: 'matches',
    label: 'Matches',
    empty: 'Aucun match pour le moment.',
    failure: 'Impossible de charger tes matches.',
    listLabel: 'Matches',
  },
  {
    value: 'likes',
    label: 'Mes likes',
    empty: 'Vous n’avez encore liké aucune offre.',
    failure: 'Impossible de charger tes likes.',
    listLabel: 'Mes likes',
  },
];

const avatarClasses = ['bg-brand', 'bg-violet', 'bg-[#e8a712]', 'bg-[#0ea5b5]', 'bg-[#df3c7d]'];

const initial = (name: string) => name.charAt(0).toUpperCase();

function toPreview(match: MatchListItemDto): MatchPreview {
  const { counterpart } = match;
  const age = Date.now() - new Date(match.matchedAt).getTime();

  return {
    id: String(match.id),
    name: counterpart.name,
    // Le titre du poste, quand l'entreprise n'a pas d'accroche à afficher.
    role: counterpart.headline ?? match.offer.title,
    time: timeSince(match.matchedAt),
    avatarClass: avatarClasses[match.id % avatarClasses.length],
    avatarUrl: fileUrl(counterpart.avatarUrl),
    isNew: age >= 0 && age < 24 * 60 * 60 * 1000,
  };
}

/**
 * A liked offer, rendered in the same row as a match. The company is the name
 * because that is what the candidate recognises; the post is the subtitle.
 */
function likedToPreview(offer: OfferFeedItemDto): MatchPreview {
  return {
    id: String(offer.id),
    name: offer.company.name,
    role: offer.title,
    time: timeSince(offer.createdAt),
    avatarClass: avatarClasses[offer.id % avatarClasses.length],
    avatarUrl: fileUrl(offer.company.logo),
  };
}

function MatchRow({ match }: { match: MatchPreview }) {
  return (
    <li>
      <div className="flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-2.5 text-left shadow-[0_8px_22px_-18px_rgba(11,27,23,0.5)] sm:min-h-15 sm:px-4">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-sm font-bold text-white shadow-sm sm:size-10',
            match.avatarClass,
          )}
          aria-hidden="true"
        >
          {match.avatarUrl ? (
            <img src={match.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initial(match.name)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold text-ink sm:text-sm">{match.name}</span>
            {match.isNew && (
              <span className="rounded-full bg-brand-tint px-1.5 py-0.5 text-[0.5rem] font-bold tracking-wide text-brand uppercase">
                New
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[0.6rem] text-ink-muted sm:text-xs">
            {match.role}
          </span>
        </span>
        <time className="shrink-0 text-[0.55rem] text-ink-faint sm:text-xs">{match.time}</time>
      </div>
    </li>
  );
}

type LoadState = 'loading' | 'ready' | 'failed';

export function MatchesPage() {
  const [activeTab, setActiveTab] = useState<MatchTab>('matches');
  const [matches, setMatches] = useState<MatchListItemDto[]>([]);
  const [likes, setLikes] = useState<OfferFeedItemDto[]>([]);
  const [matchState, setMatchState] = useState<LoadState>('loading');
  const [likeState, setLikeState] = useState<LoadState>('loading');
  const [likesRequested, setLikesRequested] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void matchControllerFindMine()
      .then((response) => {
        if (isCurrent) {
          setMatches(response.data);
          setMatchState('ready');
        }
      })
      .catch(() => {
        if (isCurrent) {
          setMatchState('failed');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  /**
   * Fetched when the tab is first opened, not on mount: half the readers never
   * open it, and the list does not change while they sit on the other one.
   */
  useEffect(() => {
    if (!likesRequested) {
      return;
    }

    let isCurrent = true;

    void offerControllerFindLiked()
      .then((response) => {
        if (isCurrent) {
          setLikes(response.data);
          setLikeState('ready');
        }
      })
      .catch(() => {
        if (isCurrent) {
          setLikeState('failed');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [likesRequested]);

  const open = (tab: MatchTab): void => {
    setActiveTab(tab);

    if (tab === 'likes') {
      setLikesRequested(true);
    }
  };

  const tab = TABS.find((candidate) => candidate.value === activeTab) ?? TABS[0];
  const onMatches = activeTab === 'matches';
  const state = onMatches ? matchState : likeState;
  const previews = onMatches ? matches.map(toPreview) : likes.map(likedToPreview);

  return (
    <div className="mx-auto max-w-3xl md:mx-0 lg:max-w-4xl xl:max-w-5xl">
      <h1 className="mt-5 font-heading text-xl font-bold text-ink md:mt-0 md:text-2xl">
        Tes matches
      </h1>
      <div className="mt-3 border-b border-line">
        <div role="tablist" aria-label="Filtrer les matches" className="flex gap-6 sm:gap-10">
          {TABS.map((item) => {
            const isActive = item.value === activeTab;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => open(item.value)}
                className={cn(
                  '-mb-px cursor-pointer border-b-2 px-0.5 pb-2 text-[0.65rem] transition-colors sm:text-xs',
                  isActive
                    ? 'border-brand font-semibold text-brand-strong'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <ul
        className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:gap-3"
        aria-label={`${tab.listLabel} liste`}
      >
        {state === 'loading' && <li className="px-3 py-4 text-sm text-ink-muted">Chargement…</li>}
        {state === 'failed' && <li className="px-3 py-4 text-sm text-ink-muted">{tab.failure}</li>}
        {state === 'ready' && previews.length === 0 && (
          <li className="px-3 py-4 text-sm text-ink-muted">{tab.empty}</li>
        )}
        {state === 'ready' &&
          previews.map((preview) => <MatchRow key={preview.id} match={preview} />)}
      </ul>
    </div>
  );
}
