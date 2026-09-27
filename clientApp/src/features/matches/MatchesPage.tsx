import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Heart, HeartHandshake, HeartOff, Inbox, type LucideIcon } from 'lucide-react';
import { ApiError } from '@/api/customFetch';
import {
  likeControllerFindReceived,
  likeControllerFindSent,
  matchControllerFindMine,
  matchControllerUnmatch,
  type LikeListItemDto,
  type MatchCounterpartDto,
  type MatchListItemDto,
  type MatchOfferDto,
} from '@/api/generated';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { isCandidate, isRecruiter } from '@/domain/userType';
import { useAuth } from '@/features/auth/useAuth';
import type { BusinessMessages } from '@/lib/feedback/failureMessage';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';
import { fileUrl } from '@/lib/fileUrl';
import { cn, timeSince } from '@/lib/utils';

const PAGE_SIZE = 50;

// The open tab lives in the URL: a detail screen can then come back to it, and
// a reload does not land the reader somewhere they never chose.
const TAB_PARAM = 'onglet';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type TabValue = 'matches' | 'sent' | 'received';

type LoadState = 'loading' | 'ready' | 'failed';

/** State of a page beyond the first, which never hides the rows already read. */
type MoreState = 'idle' | 'loading' | 'failed';

/**
 * One row of any of the three lists. They come from two endpoints and three
 * queries, but a reader sees the same thing each time — a counterpart, what
 * they are about, and when — so they are flattened here rather than branched on
 * at render time.
 */
interface ListRow {
  key: string;
  /** Where the row leads. Absent when the reader has no screen to be sent to. */
  to?: string;
  name: string;
  role: string;
  /** The offer at stake, when the row does not already name it. */
  offer?: string;
  time: string;
  /** The machine-readable date behind `time`. */
  dateTime: string;
  avatarUrl: string | null;
  isNew?: boolean;
  /**
   * The match this row stands for, which is also what can be undone. Only the
   * match rows carry it: a like without a match has no match to end, and the
   * two like tabs exclude the pairs that have one.
   */
  matchId?: number;
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

/**
 * A recruiter reads their own offers on these rows and has several of them, so
 * the counterpart alone leaves them guessing. A candidate does not: the API
 * fills a company's headline with the very title of the offer, so spelling it
 * out again would cost a line and say nothing.
 */
const offerLine = (counterpart: MatchCounterpartDto, offer: MatchOfferDto): string | undefined =>
  counterpart.kind === 'candidate' ? `Offre : ${offer.title}` : undefined;

/**
 * There is no standalone candidate screen: the applicants of the offer are
 * where a recruiter answers them.
 */
const applicantsPath = (offerId: number) => `/recruteur/offres/${offerId}/candidats`;

function matchRow(match: MatchListItemDto): ListRow {
  const age = Date.now() - new Date(match.matchedAt).getTime();

  return {
    key: `match-${match.id}`,
    to:
      match.counterpart.kind === 'candidate'
        ? applicantsPath(match.offer.id)
        : `/offres/${match.offer.id}`,
    name: match.counterpart.name,
    role: match.counterpart.headline ?? match.offer.title,
    offer: offerLine(match.counterpart, match.offer),
    time: timeSince(match.matchedAt),
    dateTime: match.matchedAt,
    avatarUrl: fileUrl(match.counterpart.avatarUrl),
    isNew: age >= 0 && age < DAY_IN_MS,
    matchId: match.id,
  };
}

function sentRow(like: LikeListItemDto): ListRow {
  return {
    key: `sent-${like.offerId}`,
    to: `/offres/${like.offerId}`,
    name: like.counterpart.name,
    role: like.counterpart.headline ?? like.offer.title,
    time: timeSince(like.likedAt),
    dateTime: like.likedAt,
    avatarUrl: fileUrl(like.counterpart.avatarUrl),
  };
}

function receivedRow(like: LikeListItemDto): ListRow {
  return {
    // The same candidate may have liked several offers, so neither identifier
    // is unique on its own.
    key: `received-${like.offerId}-${like.counterpart.id}`,
    to: applicantsPath(like.offerId),
    name: like.counterpart.name,
    role: like.counterpart.headline ?? like.offer.title,
    offer: offerLine(like.counterpart, like.offer),
    time: timeSince(like.likedAt),
    dateTime: like.likedAt,
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
 * What failed on a page beyond the first is the pagination, not the list: the
 * rows stay on screen, so naming the list here would contradict them.
 */
const MORE_FAILURE = 'Impossible de charger la suite.';

/** Where each role goes looking for someone to like. */
const CANDIDATE_FEED_PATH = '/candidat/offres';
const RECRUITER_OFFERS_PATH = '/recruteur/offres';

interface EmptyAction {
  label: string;
  to: string;
}

/**
 * Each tab carries its own wording: an empty match list, an empty like list and
 * a silent inbox are not the same silence, and neither is a failure to load one
 * or the other.
 */
interface TabModel {
  value: TabValue;
  /** How the tab spells itself in the URL. */
  slug: string;
  label: string;
  empty: string;
  emptyHint: string;
  emptyIcon: LucideIcon;
  /** Absent when the role has nowhere obvious to be sent. */
  emptyAction?: EmptyAction;
  failure: string;
  moreFailure: string;
  listLabel: string;
  load: LoadPage;
}

const BROWSE_OFFERS: EmptyAction = { label: 'Parcourir les offres', to: CANDIDATE_FEED_PATH };
const SEE_MY_OFFERS: EmptyAction = { label: 'Voir mes offres', to: RECRUITER_OFFERS_PATH };

const MATCHES_TAB: TabModel = {
  value: 'matches',
  slug: 'matches',
  label: 'Matchs',
  empty: 'Aucun match pour le moment',
  emptyHint: 'Quand l’intérêt est réciproque, le match apparaît ici.',
  emptyIcon: HeartHandshake,
  failure: 'Impossible de charger vos matchs.',
  moreFailure: MORE_FAILURE,
  listLabel: 'Matchs',
  load: loadMatches,
};

const SENT_TAB: TabModel = {
  value: 'sent',
  slug: 'mes-likes',
  label: 'Mes likes',
  empty: 'Aucune offre likée',
  emptyHint: 'Les offres qui vous intéressent, en attendant la réponse de l’entreprise.',
  emptyIcon: Heart,
  emptyAction: BROWSE_OFFERS,
  failure: 'Impossible de charger vos likes.',
  moreFailure: MORE_FAILURE,
  listLabel: 'Mes likes',
  load: loadSent,
};

const RECEIVED_TAB: TabModel = {
  value: 'received',
  slug: 'recus',
  label: 'Reçus',
  empty: 'Aucun like reçu pour le moment',
  emptyHint: 'Les candidats qui s’intéressent à l’une de vos offres attendent ici votre réponse.',
  emptyIcon: Inbox,
  emptyAction: SEE_MY_OFFERS,
  failure: 'Impossible de charger les likes reçus.',
  moreFailure: MORE_FAILURE,
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
  const candidate = isCandidate(userType);
  const recruiter = isRecruiter(userType);
  const emptyAction = candidate ? BROWSE_OFFERS : recruiter ? SEE_MY_OFFERS : undefined;

  return [
    { ...MATCHES_TAB, emptyAction },
    ...(candidate ? [SENT_TAB] : []),
    ...(recruiter ? [RECEIVED_TAB] : []),
  ];
}

/** One line under the title, saying what the screen holds for this role. */
function subtitleFor(userType: string | undefined): string {
  if (isCandidate(userType)) {
    return 'Les entreprises qui s’intéressent aussi à vous, et les offres que vous avez likées.';
  }

  if (isRecruiter(userType)) {
    return 'Les candidats avec qui l’intérêt est réciproque, et ceux qui attendent votre réponse.';
  }

  return 'Les personnes avec qui l’intérêt est réciproque.';
}

interface PagedList {
  rows: ListRow[];
  state: LoadState;
  more: MoreState;
  hasMore: boolean;
  loadMore: () => void;
  /**
   * Drops one row without refetching. Asking the endpoint again would renumber
   * the pages already read under the reader's eyes, for a single row they just
   * watched disappear.
   */
  remove: (key: string) => void;
}

/**
 * A list read one page at a time, fetched only once `enabled` turns true.
 *
 * A full page is what tells us another one exists: the endpoints return rows
 * and no total, and asking for one would cost a COUNT on every scroll for an
 * answer nobody reads.
 *
 * `state` answers for the first page alone. What happens to the next ones is
 * `more`, so that a page in flight or in error never takes away rows the reader
 * is already looking at.
 */
function usePagedList(load: LoadPage, enabled: boolean): PagedList {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [more, setMore] = useState<MoreState>('idle');
  const [hasMore, setHasMore] = useState(false);
  // Refs, not state: `loadMore` reads them at click time, and a value captured
  // by the render that mounted the button would be one click behind.
  const loadedPages = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCurrent = true;

    void load(1)
      .then((fetched) => {
        if (!isCurrent) {
          return;
        }

        loadedPages.current = 1;
        setRows(fetched);
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
  }, [enabled, load]);

  // No cleanup cancels this one: the reader asked for these rows, and dropping
  // the answer in flight would lose a page nobody asks for twice.
  const loadMore = useCallback(() => {
    if (inFlight.current || loadedPages.current === 0) {
      return;
    }

    const next = loadedPages.current + 1;

    inFlight.current = true;
    setMore('loading');

    void load(next)
      .then((fetched) => {
        loadedPages.current = next;
        setRows((previous) => [...previous, ...fetched]);
        setHasMore(fetched.length === PAGE_SIZE);
        setMore('idle');
      })
      .catch(() => {
        // `loadedPages` stays put, so a retry asks for the page that failed.
        setMore('failed');
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [load]);

  const remove = useCallback((key: string) => {
    setRows((previous) => previous.filter((row) => row.key !== key));
  }, []);

  return { rows, state, more, hasMore, loadMore, remove };
}

type UnmatchState = 'idle' | 'confirming' | 'pending';

/** Nothing business-specific to say: 401, 403 and 500 all read as a failure. */
const UNMATCH_FAILURE: BusinessMessages = {};

/**
 * A 404 means the match is already gone — the other member ended it, or this
 * screen has been open a while. It counts as done: leaving the row would show
 * something the server no longer knows about, and a second attempt would answer
 * 404 again.
 */
const isAlreadyEnded = (cause: unknown): boolean =>
  cause instanceof ApiError && cause.status === 404;

interface Unmatch {
  state: UnmatchState;
  ask: () => void;
  cancel: () => void;
  confirm: () => Promise<void>;
}

function useUnmatch(matchId: number | undefined, name: string, onEnded: () => void): Unmatch {
  const [state, setState] = useState<UnmatchState>('idle');

  const confirm = async (): Promise<void> => {
    if (matchId === undefined) {
      return;
    }

    setState('pending');

    try {
      await matchControllerUnmatch(matchId);
    } catch (cause) {
      if (!isAlreadyEnded(cause)) {
        notifyFailure(cause, UNMATCH_FAILURE);
        // Back to the first step, not to the question: a failure is no reason to
        // leave a confirmed deletion one click away from a reader who has just
        // been told it did not happen.
        setState('idle');

        return;
      }
    }

    notifySuccess(`Le match avec ${name} est terminé.`);
    // Last: the row unmounts with it, and nothing may set state afterwards.
    onEnded();
  };

  return {
    state,
    ask: () => setState('confirming'),
    cancel: () => setState('idle'),
    confirm,
  };
}

/**
 * Ending a match cannot be undone, so it is asked twice. The question is raised
 * in the row rather than in a modal: this codebase has no dialog primitive, and
 * a hand-rolled one would have to earn a focus trap, a restore and an escape
 * key for a two-word question. In the row, the confirmation stays next to the
 * name it is about and the focus never leaves the list.
 */
function UnmatchTrigger({ name, unmatch }: { name: string; unmatch: Unmatch }) {
  const isOpen = unmatch.state !== 'idle';

  return (
    <button
      type="button"
      // The control is the same on every row, so its name carries the
      // counterpart: it is the only thing telling two rows apart.
      aria-label={`Mettre fin au match avec ${name}`}
      aria-expanded={isOpen}
      title="Mettre fin au match"
      disabled={unmatch.state === 'pending'}
      onClick={isOpen ? unmatch.cancel : unmatch.ask}
      className={cn(
        'mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none disabled:cursor-default disabled:opacity-50',
        isOpen
          ? 'bg-destructive-tint text-destructive'
          : 'text-ink-faint hover:bg-destructive-tint hover:text-destructive',
      )}
    >
      <HeartOff aria-hidden="true" className="size-5" />
    </button>
  );
}

function UnmatchConfirmation({ name, unmatch }: { name: string; unmatch: Unmatch }) {
  const isPending = unmatch.state === 'pending';

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-3">
      <span className="mr-auto text-sm text-ink-muted">Mettre fin au match avec {name} ?</span>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="h-11 rounded-xl px-4 text-ink-muted hover:bg-surface hover:text-ink"
        // Nothing to cancel once the call is in flight: the server is already
        // deciding, and re-offering the way out would promise a rollback.
        disabled={isPending}
        onClick={unmatch.cancel}
      >
        Annuler
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="lg"
        className="h-11 rounded-xl px-4"
        aria-label={isPending ? undefined : `Confirmer la fin du match avec ${name}`}
        disabled={isPending}
        onClick={() => void unmatch.confirm()}
      >
        {isPending ? 'Suppression…' : 'Confirmer'}
      </Button>
    </div>
  );
}

function Avatar({ row }: { row: ListRow }) {
  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint text-base font-extrabold text-brand-strong"
      aria-hidden="true"
    >
      {row.avatarUrl ? (
        <img src={row.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        initial(row.name)
      )}
    </span>
  );
}

function Row({
  row,
  from,
  onRemove,
}: {
  row: ListRow;
  from: string;
  onRemove: (key: string) => void;
}) {
  const unmatch = useUnmatch(row.matchId, row.name, () => onRemove(row.key));

  const body = (
    <>
      <Avatar row={row} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-ink">{row.name}</span>
          {row.isNew && (
            <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-strong">
              Nouveau
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">{row.role}</span>
        {row.offer !== undefined && (
          <span className="mt-0.5 block truncate text-xs text-ink-muted">{row.offer}</span>
        )}
      </span>
      <time dateTime={row.dateTime} className="tabular shrink-0 text-xs text-ink-muted">
        {row.time}
      </time>
    </>
  );

  const shell = 'flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left';

  return (
    // The action is a sibling of the link, never inside it: a button nested in
    // an anchor is invalid, and a click on the row would then fire both.
    <li>
      <div className="flex items-center">
        {row.to === undefined ? (
          <div className={shell}>{body}</div>
        ) : (
          // A real link, not a clickable `div`: the row has to be reachable with
          // a keyboard and openable in a new tab.
          <Link
            to={row.to}
            // Where the reader came from, so the screen they open can bring them
            // back to this very tab rather than to the role's home.
            state={{ from }}
            className={cn(
              shell,
              'transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none focus-visible:ring-inset',
            )}
          >
            {body}
          </Link>
        )}
        {row.matchId !== undefined && <UnmatchTrigger name={row.name} unmatch={unmatch} />}
      </div>
      {row.matchId !== undefined && unmatch.state !== 'idle' && (
        <UnmatchConfirmation name={row.name} unmatch={unmatch} />
      )}
    </li>
  );
}

function ListSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="divide-y divide-line rounded-2xl border border-line bg-card shadow-card"
    >
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex min-h-16 items-center gap-3 px-4 py-3">
          <div className="size-11 shrink-0 animate-pulse rounded-full bg-surface" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-2/5 animate-pulse rounded-xl bg-surface" />
            <div className="h-3 w-3/5 animate-pulse rounded-xl bg-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTab({ tab }: { tab: TabModel }) {
  const Icon = tab.emptyIcon;

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-tint text-brand">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink">{tab.empty}</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">{tab.emptyHint}</p>
      {tab.emptyAction && (
        <Link
          to={tab.emptyAction.to}
          className={cn(buttonVariants({ variant: 'brand', size: 'xl' }), 'mt-6 w-full max-w-xs')}
        >
          {tab.emptyAction.label}
        </Link>
      )}
    </div>
  );
}

export function MatchesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Fetched when a tab is first opened, not on mount: half the readers never
  // open the second one, and the list does not change while they sit on the
  // other. The open tab needs no entry here, being enabled by being open.
  const [opened, setOpened] = useState<readonly TabValue[]>([]);

  const tabs = tabsFor(user?.userType);
  // An unknown slug, or one naming a tab this role does not have, reads as no
  // tab at all: a link a reader was sent cannot break their screen.
  const tab = tabs.find((candidate) => candidate.slug === searchParams.get(TAB_PARAM)) ?? tabs[0];

  const wasOpened = (value: TabValue) => value === tab.value || opened.includes(value);

  const lists: Record<TabValue, PagedList> = {
    matches: usePagedList(MATCHES_TAB.load, wasOpened('matches')),
    sent: usePagedList(SENT_TAB.load, wasOpened('sent')),
    received: usePagedList(RECEIVED_TAB.load, wasOpened('received')),
  };

  const list = lists[tab.value];
  const from = `${location.pathname}${location.search}`;

  const open = (opening: TabModel): void => {
    setOpened((current) =>
      current.includes(opening.value) ? current : [...current, opening.value],
    );
    // Replaced, not pushed: reading the other tab is not a step of the journey,
    // and one history entry per click would bury the way back.
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(TAB_PARAM, opening.slug);

        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="mx-auto max-w-3xl md:mx-0 lg:max-w-4xl xl:max-w-5xl">
      {/* The title names the open tab: a recruiter reading « Reçus » is not
          reading their matches. */}
      <h1 className="mt-5 text-2xl font-extrabold text-ink md:mt-0 md:text-[1.75rem]">
        {tab.listLabel}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">{subtitleFor(user?.userType)}</p>

      <div
        role="tablist"
        aria-label="Filtrer les matchs"
        className="mt-5 inline-flex rounded-xl bg-surface p-1"
      >
        {tabs.map((item) => {
          const isActive = item.value === tab.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => open(item)}
              className={cn(
                'h-10 cursor-pointer rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none',
                isActive ? 'bg-card text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {list.state === 'loading' && (
          <>
            <p role="status" className="sr-only">
              Chargement…
            </p>
            <ListSkeleton />
          </>
        )}
        {list.state === 'failed' && (
          <p
            role="alert"
            className="rounded-2xl border border-line bg-card px-4 py-6 text-center text-sm text-destructive shadow-card"
          >
            {tab.failure}
          </p>
        )}
        {list.state === 'ready' && list.rows.length === 0 && <EmptyTab tab={tab} />}
        {list.state === 'ready' && list.rows.length > 0 && (
          <ul
            aria-label={`${tab.listLabel} liste`}
            className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card shadow-card"
          >
            {list.rows.map((row) => (
              <Row key={row.key} row={row} from={from} onRemove={list.remove} />
            ))}
          </ul>
        )}
      </div>

      {list.state === 'ready' && list.more === 'failed' && (
        <p role="alert" className="mt-4 text-center text-sm text-destructive">
          {tab.moreFailure}{' '}
          <button
            type="button"
            onClick={list.loadMore}
            className="cursor-pointer font-semibold text-brand-strong underline underline-offset-2 focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            Réessayer
          </button>
        </p>
      )}
      {list.state === 'ready' && list.hasMore && list.more !== 'failed' && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={list.loadMore}
          disabled={list.more === 'loading'}
          className="mt-4 h-11 w-full rounded-xl"
        >
          {list.more === 'loading' ? 'Chargement…' : 'Voir plus'}
        </Button>
      )}
    </div>
  );
}
