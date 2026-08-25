import { SKILL_CHIP } from '@/components/ui/chip-variants';
import { contractLabel, metaLine } from '@/components/feed/labels';
import { FeedCard } from '@/components/feed/FeedCard';
import { offerSalaryLabel } from '../labels';
import type { FeedOffer } from '../types';

interface OfferCardProps {
  offer: FeedOffer;
  onViewOffer: () => void;
}

/** Candidate-side mapping of an offer into the shared feed card frame. */
export function OfferCard({ offer, onViewOffer }: OfferCardProps) {
  return (
    <FeedCard
      bannerName={offer.companyName}
      bannerImageUrl={offer.companyLogoUrl}
      title={offer.title}
      metadata={metaLine([offer.companyName, contractLabel(offer.contractType), offer.city])}
      chipsLabel="Stack technique"
      chips={offer.stack}
      chipsClassName={SKILL_CHIP}
      metric={offerSalaryLabel(offer.salaryMin, offer.salaryMax)}
      description={offer.description}
      detailText="Voir plus"
      detailLabel={`Voir l'offre ${offer.title}`}
      onViewDetails={onViewOffer}
    />
  );
}
