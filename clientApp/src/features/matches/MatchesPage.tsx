import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  likeControllerFindReceived,
  likeControllerFindSent,
  matchControllerFindMine,
  type LikeListItemDto,
  type MatchListItemDto,
} from '@/api/generated';
import { isCandidate, isRecruiter } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import { fileUrl } from '@/lib/fileUrl';
import { cn, timeSince } from '@/lib/utils';

const PAGE_SIZE = 50;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type TabValue = 'matches' | 'sent' | 'received';

type LoadState = 'loading' | 'ready' | 'failed';

/**
 * One row of any of the three lists. They come from two endpoints and three
 * queries, but a reader sees the same thing each time — a counterpart, what
 * they are about, and when — so they are flattened here rather than branched on
 * at render time.
 */
interface ListRow {
  key: string;
  /** Where the row leads. Absent on a match, which has no screen of its own. */
  to?: string;
  name: string;
  role: string;
  time: string;
  avatarClass: string;
  avatarUrl: string | null;
  isNew?: boolean;
}

const avatarClasses = ['bg-brand', 'bg-violet', 'bg-[#e8a712]', 'bg-[#0ea5b5]', 'bg-[#df3c7d]'];

const initial = (name: string) => name.charAt(0).toUpperCase();

function matchRow(match: MatchListItemDto): ListRow {
  const age = Date.now() - new Date(match.matchedAt).getTime();

  return {
    key: `match-${match.id}`,
    name: match.counterpart.name,
    // Le titre du poste, quand l'entreprise n'a pas d'accroche à afficher.
    role: match.counterpart.headline ?? match.offer.title,
    time: timeSince(match.matchedAt),
    avatarClass: avatarClasses[match.id % avatarClasses.length],
    avatarUrl: fileUrl(match.counterpart.avatarUrl),
    isNew: age >= 0 && age < DAY_IN_MS,
  };
}

function sentRow(like: LikeListItemDto): ListRow {
  return {
    key: `sent-${like.offerId}`,
    to: `/offres/${like.offerId}`,
    name: like.counterpart.name,
    role: like.counterpart.headline ?? like.offer.title,
    time: timeSince(like.likedAt),
    avatarClass: avatarClasses[like.offerId % avatarClasses.length],
    avatarUrl: fileUrl(like.counterpart.avatarUrl),
  };
}

function receivedRow(like: LikeListItemDto): ListRow {
  return {
    // The same candidate may have liked several offers, so neither identifier
    // is unique on its own.
    key: `received-${like.offerId}-${like.counterpart.id}`,
    // There is no standalone candidate screen: the applicants of the offer they
    // liked is where a recruiter answers them.
    to: `/recruteur/offres/${like.offerId}/candidats`,
    name: like.counterpart.name,
    role: like.counterpart.headline ?? like.offer.title,
    time: timeSince(like.likedAt),
    avatarClass: avatarClasses[like.counterpart.id % avatarClasses.length],
    avatarUrl: fileUrl(like.counterpart.avatarUrl),
  };
}

type LoadPage = (page: number) => Promise<ListRow[]>;

const loadMatches: LoadPage = (page) =>
  matchControllerFindMine({ page, limit: PAGE_SIZE }).then(({ data }) => data.map(matchRow));

const loadSent: LoadPage = (page) =>
  likeControllerFindSent({ page, limit: PAGE_SIZE }).then(({ data }) => data.map(sentRow));

const loadReceived: LoadPage = (page) =>
  likeControllerFindReceived({ page, limit: PAGE_SIZE }).then(({ data }) => data.map(receivedRow));

/**
 * Each tab carries its own wording: an empty match list, an empty like list and
 * a silent inbox are not the same silence, and neither is a failure to load one
 * or the other.
 */
interface TabModel {
  value: TabValue;
  label: string;
  empty: string;
  failure: string;
  listLabel: string;
  load: LoadPage;
}

const MATCHES_TAB: TabModel = {
  value: 'matches',
  label: 'Matches',
  empty: 'Aucun match pour le moment.',
  failure: 'Impossible de charger tes matches.',
  listLabel: 'Matches',
  load: loadMatches,
};

const SENT_TAB: TabModel = {
  value: 'sent',
  label: 'Mes likes',
  empty: 'Vous n’avez encore liké aucune offre.',
  failure: 'Impossible de charger tes likes.',
  listLabel: 'Mes likes',
  load: loadSent,
};

const RECEIVED_TAB: TabModel = {
  value: 'received',
  label: 'Reçus',
  empty: 'Aucun candidat n’a encore liké tes offres.',
  failure: 'Impossible de charger les likes reçus.',
  listLabel: 'Reçus',
  load: loadReceived,
};

/**
 * The second tab depends on the role, because a like without a match only
 * exists on one side. A recruiter can only like a candidate who already liked
 * one of their offers, and that like immediately creates the match: their own
 * « Mes likes » would always be empty, and a candidate's « Reçus » can never
 * hold anything. An unrecognised role gets the matches alone rather than the
 * candidate list by default — it is the only tab true of both.
 */
function tabsFor(userType: string | undefined): readonly TabModel[] {
  return [
    MATCHES_TAB,
    ...(isCandidate(userType) ? [SENT_TAB] : []),
    ...(isRecruiter(userType) ? [RECEIVED_TAB] : []),
  ];
}

interface PagedList {
  rows: ListRow[];
  state: LoadState;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * A list read one page at a time, fetched only once `enabled` turns true.
 *
 * A full page is what tells us another one exists: the endpoints return rows
 * and no total, and asking for one would cost a COUNT on every scroll for an
 * answer nobody reads.
 */
function usePagedList(load: LoadPage, enabled: boolean): PagedList {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCurrent = true;

    void load(page)
      .then((fetched) => {
        if (!isCurrent) {
          return;
        }

        setRows((previous) => (page === 1 ? fetched : [...previous, ...fetched]));
        setHasMore(fetched.length === PAGE_SIZE);
        setState('ready');
      })
      .catch(() => {
        if (isCurrent) {
          setState('failed');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [enabled, load, page]);

  return { rows, state, hasMore, loadMore: () => setPage((current) => current + 1) };
}

function Row({ row }: { row: ListRow }) {
  const body = (
    <>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-sm font-bold text-white shadow-sm sm:size-10',
          row.avatarClass,
        )}
        aria-hidden="true"
      >
        {row.avatarUrl ? (
          <img src={row.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          initial(row.name)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-bold text-ink sm:text-sm">{row.name}</span>
          {row.isNew && (
            <span className="rounded-full bg-brand-tint px-1.5 py-0.5 text-[0.5rem] font-bold tracking-wide text-brand uppercase">
              New
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[0.6rem] text-ink-muted sm:text-xs">
          {row.role}
        </span>
      </span>
      <time className="shrink-0 text-[0.55rem] text-ink-faint sm:text-xs">{row.time}</time>
    </>
  );

  const shell =
    'flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-2.5 text-left shadow-[0_8px_22px_-18px_rgba(11,27,23,0.5)] sm:min-h-15 sm:px-4';

  return (
    <li>
      {row.to === undefined ? (
        <div className={shell}>{body}</div>
      ) : (
        // A real link, not a clickable `div`: the row has to be reachable with
        // a keyboard and openable in a new tab.
        <Link
          to={row.to}
          className={cn(
            shell,
            'transition-shadow hover:shadow-[0_10px_26px_-16px_rgba(11,27,23,0.55)]',
          )}
        >
          {body}
        </Link>
      )}
    </li>
  );
}

export function MatchesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabValue>('matches');
  // Fetched when a tab is first opened, not on mount: half the readers never
  // open the second one, and the list does not change while they sit on the
  // other.
  const [opened, setOpened] = useState<readonly TabValue[]>(['matches']);

  const wasOpened = (value: TabValue) => opened.includes(value);

  const lists: Record<TabValue, PagedList> = {
    matches: usePagedList(MATCHES_TAB.load, wasOpened('matches')),
    sent: usePagedList(SENT_TAB.load, wasOpened('sent')),
    received: usePagedList(RECEIVED_TAB.load, wasOpened('received')),
  };

  const tabs = tabsFor(user?.userType);
  const tab = tabs.find((candidate) => candidate.value === activeTab) ?? tabs[0];
  const list = lists[tab.value];

  const open = (value: TabValue): void => {
    setActiveTab(value);
    setOpened((current) => (current.includes(value) ? current : [...current, value]));
  };

  return (
    <div className="mx-auto max-w-3xl md:mx-0 lg:max-w-4xl xl:max-w-5xl">
      <h1 className="mt-5 font-heading text-xl font-bold text-ink md:mt-0 md:text-2xl">
        Tes matches
      </h1>
      <div className="mt-3 border-b border-line">
        <div role="tablist" aria-label="Filtrer les matches" className="flex gap-6 sm:gap-10">
          {tabs.map((item) => {
            const isActive = item.value === tab.value;
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
        {list.state === 'loading' && (
          <li className="px-3 py-4 text-sm text-ink-muted">Chargement…</li>
        )}
        {list.state === 'failed' && (
          <li className="px-3 py-4 text-sm text-ink-muted">{tab.failure}</li>
        )}
        {list.state === 'ready' && list.rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-ink-muted">{tab.empty}</li>
        )}
        {list.state === 'ready' && list.rows.map((row) => <Row key={row.key} row={row} />)}
      </ul>
      {list.state === 'ready' && list.hasMore && (
        <button
          type="button"
          onClick={list.loadMore}
          className="mt-4 w-full cursor-pointer rounded-2xl border border-line px-4 py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink sm:text-sm"
        >
          Voir plus
        </button>
      )}
    </div>
  );
}
