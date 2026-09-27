import { ArrowRight } from 'lucide-react';
import { ChipList } from './ChipList';
import { FactList, type Fact } from '@/components/ui/fact-list';

interface FeedCardProps {
  avatarName: string;
  avatarImageUrl: string | null;
  ownerName: string;
  ownerMeta?: string | null;
  title: string;
  facts: readonly Fact[];
  chipsLabel: string;
  chips: readonly string[];
  chipsClassName: string;
  description: string;
  detailLabel: string;
  detailText: string;
  onViewDetails: () => void;
}

/**
 * The deck's card: who is behind it, what it is, then the facts that decide a
 * yes or a no as aligned label/value rows, so two cards read the same way and
 * a missing value stands out instead of hiding in a sentence.
 */
export function FeedCard({
  avatarName,
  avatarImageUrl,
  ownerName,
  ownerMeta,
  title,
  facts,
  chipsLabel,
  chips,
  chipsClassName,
  description,
  detailLabel,
  detailText,
  onViewDetails,
}: FeedCardProps) {
  const source = avatarImageUrl?.trim() || null;
  const normalisedMeta = ownerMeta?.trim() || null;
  const normalisedDescription = description.trim();

  return (
    <article className="flex w-full flex-col rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint">
          {source === null ? (
            <span aria-hidden="true" className="text-base font-extrabold text-brand-strong">
              {avatarName.trim().charAt(0).toUpperCase()}
            </span>
          ) : (
            <img src={source} alt="" className="size-full object-cover" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{ownerName}</p>
          {normalisedMeta !== null && (
            <p className="truncate text-xs text-ink-muted">{normalisedMeta}</p>
          )}
        </div>
      </div>

      <h2 className="mt-4 text-xl leading-tight font-extrabold break-words text-ink sm:text-2xl">
        {title}
      </h2>

      <FactList facts={facts} edges="open" className="mt-4" />

      {chips.length > 0 && (
        <div className="mt-4">
          <ChipList label={chipsLabel} items={chips} chipClassName={chipsClassName} />
        </div>
      )}

      {normalisedDescription !== '' && (
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed break-words text-ink-muted">
          {normalisedDescription}
        </p>
      )}

      <button
        type="button"
        aria-label={detailLabel}
        onClick={onViewDetails}
        className="mt-4 inline-flex cursor-pointer items-center gap-1.5 self-start rounded-md text-sm font-bold text-brand-strong underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
      >
        {detailText}
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </article>
  );
}
