import type { OfferFeedItemDto } from '@/api/generated';
import { SKILL_CHIP } from '@/components/ui/chip-variants';
import { contractLabel, metaLine, offerSalaryLabel } from '@/components/feed/labels';
import { FeedCard } from '@/components/feed/FeedCard';
import { fileUrl } from '@/lib/fileUrl';

interface OfferCardProps {
  offer: OfferFeedItemDto;
  onViewOffer: () => void;
}

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
        offer.contractType === null ? null : contractLabel(offer.contractType),
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
