import { useEffect, useState } from 'react';
import { matchControllerFindMine, type MatchListItemDto } from '@/api/generated';
import { fileUrl } from '@/lib/fileUrl';
import { cn, timeSince } from '@/lib/utils';

type MatchTab = 'matches' | 'likes' | 'received';

interface MatchPreview {
  id: string;
  name: string;
  role: string;
  time: string;
  avatarClass: string;
  avatarUrl?: string | null;
  isNew?: boolean;
}

const tabs: { value: MatchTab; label: string }[] = [
  { value: 'matches', label: 'Matches' },
  { value: 'likes', label: 'Mes likes' },
  { value: 'received', label: 'Reçus' },
];

const previewTabs: Record<Exclude<MatchTab, 'matches'>, MatchPreview[]> = {
  likes: [
    {
      id: 'aster',
      name: 'Aster Studio',
      role: 'Product Designer',
      time: 'il y a 3 h',
      avatarClass: 'bg-coral',
    },
    {
      id: 'pixel',
      name: 'Pixel & Co.',
      role: 'Développeur Frontend',
      time: 'il y a 1 j',
      avatarClass: 'bg-violet',
    },
  ],
  received: [
    {
      id: 'orbit',
      name: 'Orbit',
      role: 'Développeur Backend',
      time: 'il y a 20 min',
      avatarClass: 'bg-brand',
      isNew: true,
    },
    {
      id: 'cobalt',
      name: 'Cobalt',
      role: 'DevOps Engineer',
      time: 'il y a 1 j',
      avatarClass: 'bg-[#0ea5b5]',
    },
  ],
};

const avatarClasses = ['bg-brand', 'bg-violet', 'bg-[#e8a712]', 'bg-[#0ea5b5]', 'bg-[#df3c7d]'];

const initial = (name: string) => name.charAt(0).toUpperCase();

function toPreview(match: MatchListItemDto): MatchPreview {
  const counterpart = match.counterpart;
  const age = Date.now() - new Date(match.matchedAt).getTime();

  return {
    id: String(match.id),
    name: counterpart?.name ?? 'Profil indisponible',
    role: counterpart?.headline ?? match.offer.title,
    time: timeSince(match.matchedAt),
    avatarClass: avatarClasses[match.id % avatarClasses.length],
    avatarUrl: fileUrl(counterpart?.avatarUrl),
    isNew: age >= 0 && age < 24 * 60 * 60 * 1000,
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

export function MatchesPage() {
  const [activeTab, setActiveTab] = useState<MatchTab>('matches');
  const [matches, setMatches] = useState<MatchListItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void matchControllerFindMine()
      .then((response) => {
        if (isCurrent) setMatches(response.data);
      })
      .catch(() => {
        if (isCurrent) setError(true);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const previews = activeTab === 'matches' ? matches.map(toPreview) : previewTabs[activeTab];
  const currentTab = tabs.find((tab) => tab.value === activeTab)?.label ?? '';

  return (
    <div className="mx-auto max-w-3xl md:mx-0 lg:max-w-4xl xl:max-w-5xl">
      <h1 className="mt-5 font-heading text-xl font-bold text-ink md:mt-0 md:text-2xl">
        Tes matches
      </h1>
      <div className="mt-3 border-b border-line">
        <div role="tablist" aria-label="Filtrer les matches" className="flex gap-6 sm:gap-10">
          {tabs.map((tab) => {
            const isActive = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  '-mb-px cursor-pointer border-b-2 px-0.5 pb-2 text-[0.65rem] transition-colors sm:text-xs',
                  isActive
                    ? 'border-brand font-semibold text-brand-strong'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <ul
        className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:gap-3"
        aria-label={`${currentTab} liste`}
      >
        {activeTab === 'matches' && isLoading && (
          <li className="px-3 py-4 text-sm text-ink-muted">Chargement…</li>
        )}
        {activeTab === 'matches' && error && (
          <li className="px-3 py-4 text-sm text-ink-muted">Impossible de charger tes matches.</li>
        )}
        {activeTab === 'matches' && !isLoading && !error && previews.length === 0 && (
          <li className="px-3 py-4 text-sm text-ink-muted">Aucun match pour le moment.</li>
        )}
        {!isLoading || activeTab !== 'matches'
          ? previews.map((match) => <MatchRow key={match.id} match={match} />)
          : null}
      </ul>
    </div>
  );
}
