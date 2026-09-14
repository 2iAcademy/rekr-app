import { ChevronRight } from 'lucide-react';
import { AvatarBanner } from '@/components/ui/avatar-banner';
import { Button } from '@/components/ui/button';
import { ChipList } from './ChipList';

interface FeedCardProps {
  bannerName: string;
  bannerImageUrl: string | null;
  title: string;
  subtitle?: string | null;
  metadata: string;
  chipsLabel: string;
  chips: readonly string[];
  chipsClassName: string;
  metric: string;
  description: string;
  detailLabel: string;
  detailText: string;
  onViewDetails: () => void;
}

/**
 * Shared visual frame for the recruiter and candidate decks. Domain-specific
 * cards only turn their view model into these display fields; spacing, banner,
 * chips, clamping and the detail action stay identical in both feeds.
 */
export function FeedCard({
  bannerName,
  bannerImageUrl,
  title,
  subtitle,
  metadata,
  chipsLabel,
  chips,
  chipsClassName,
  metric,
  description,
  detailLabel,
  detailText,
  onViewDetails,
}: FeedCardProps) {
  const normalisedSubtitle = subtitle?.trim() || null;
  const normalisedMetadata = metadata.trim();
  const normalisedDescription = description.trim();

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-role">
      <AvatarBanner name={bannerName} imageUrl={bannerImageUrl} />

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-bold text-balance break-words text-ink">
            {title}
          </h2>
          {normalisedSubtitle !== null && (
            <p className="text-sm font-medium break-words text-role">{normalisedSubtitle}</p>
          )}
          {normalisedMetadata !== '' && (
            <p className="text-sm break-words text-ink-muted">{normalisedMetadata}</p>
          )}
        </div>

        <ChipList label={chipsLabel} items={chips} chipClassName={chipsClassName} />

        <p className="text-base font-bold break-words text-ink">{metric}</p>

        {normalisedDescription !== '' && (
          <p className="line-clamp-3 text-sm leading-relaxed break-words text-ink-muted">
            {normalisedDescription}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          aria-label={detailLabel}
          onClick={onViewDetails}
          className="-ml-2.5 self-start text-brand hover:bg-brand-tint hover:text-brand-strong"
        >
          {detailText}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </article>
  );
}
