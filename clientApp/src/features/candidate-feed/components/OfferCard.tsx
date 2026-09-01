import type { OfferFeedItemDto } from '@/api/generated';
import { SKILL_CHIP } from '@/components/ui/chip-variants';
import { contractLabel, metaLine, offerSalaryLabel } from '@/components/feed/labels';
import { REMOTE_POLICY_OPTIONS } from '@/domain/options';
import { FeedCard } from '@/components/feed/FeedCard';
import { fileUrl } from '@/lib/fileUrl';

interface OfferCardProps {
  offer: OfferFeedItemDto;
  onViewOffer: () => void;
}

/**
 * An offer that left a field empty stays in every deck, whatever the candidate
 * asked for — a post that never said is not a post that says no. Said out loud
 * rather than left blank: an omission is indistinguishable from a match, and a
 * candidate who asked for full remote would read silence as agreement.
 */
const orUnknown = (value: string | null, unknown: string): string => value ?? unknown;

const remoteLabel = (offer: OfferFeedItemDto): string =>
  orUnknown(
    REMOTE_POLICY_OPTIONS.find((option) => option.value === offer.remotePolicy)?.label ?? null,
    'Télétravail non précisé',
  );

/** Candidate-side mapping of an offer into the shared feed card frame. */
export function OfferCard({ offer, onViewOffer }: OfferCardProps) {
  const { company } = offer;

  return (
    <FeedCard
      bannerName={company.name}
      bannerImageUrl={fileUrl(company.logo)}
      title={offer.title}
      metadata={metaLine([
        company.name,
        orUnknown(
          offer.contractType === null ? null : contractLabel(offer.contractType),
          'Contrat non précisé',
        ),
        remoteLabel(offer),
        offer.city,
      ])}
      chipsLabel="Stack technique"
      chips={offer.tags}
      chipsClassName={SKILL_CHIP}
      metric={offerSalaryLabel(offer.salaryMin, offer.salaryMax)}
      description={offer.description ?? ''}
      detailText="Voir plus"
      detailLabel={`Voir l'offre ${offer.title}`}
      onViewDetails={onViewOffer}
    />
  );
}
