import type { OfferFeedItemDto } from '@/api/generated';
import { SKILL_CHIP } from '@/components/ui/chip-variants';
import { contractLabel, offerSalaryLabel } from '@/components/feed/labels';
import { EXPERIENCE_LEVEL_OPTIONS, REMOTE_POLICY_OPTIONS } from '@/domain/options';
import { FeedCard } from '@/components/feed/FeedCard';
import { fileUrl } from '@/lib/fileUrl';
import { markdownToPlainText } from '@/lib/markdown';

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
const NOT_SPECIFIED = 'Non précisé';

const labelOf = <T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | null,
): string =>
  value === null
    ? NOT_SPECIFIED
    : (options.find((option) => option.value === value)?.label ?? NOT_SPECIFIED);

/** Candidate-side mapping of an offer into the shared feed card frame. */
export function OfferCard({ offer, onViewOffer }: OfferCardProps) {
  const { company } = offer;

  return (
    <FeedCard
      avatarName={company.name}
      avatarImageUrl={fileUrl(company.logo)}
      ownerName={company.name}
      ownerMeta={offer.city}
      title={offer.title}
      facts={[
        {
          label: 'Contrat',
          value: offer.contractType === null ? NOT_SPECIFIED : contractLabel(offer.contractType),
        },
        { label: 'Télétravail', value: labelOf(REMOTE_POLICY_OPTIONS, offer.remotePolicy) },
        {
          label: 'Expérience',
          value: labelOf(EXPERIENCE_LEVEL_OPTIONS, offer.minExperienceLevel),
        },
        { label: 'Salaire', value: offerSalaryLabel(offer.salaryMin, offer.salaryMax) },
      ]}
      chipsLabel="Compétences"
      chips={offer.tags}
      chipsClassName={SKILL_CHIP}
      description={markdownToPlainText(offer.description ?? '')}
      detailText="Voir l'offre complète"
      detailLabel={`Voir l'offre ${offer.title}`}
      onViewDetails={onViewOffer}
    />
  );
}
