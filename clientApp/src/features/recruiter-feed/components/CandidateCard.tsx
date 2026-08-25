import { metaLine } from '@/components/feed/labels';
import { SKILL_CHIP } from '@/components/ui/chip-variants';
import { availabilityLabel, experienceLabel, nameWithAge, salaryWishLabel } from '../labels';
import type { FeedCandidate } from '../types';
import { FeedCard } from '@/components/feed/FeedCard';

interface CandidateCardProps {
  candidate: FeedCandidate;
  onViewProfile: () => void;
}

/** Maps a candidate view model into the shared recruiter-feed card frame. */
export function CandidateCard({ candidate, onViewProfile }: CandidateCardProps) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  return (
    <FeedCard
      bannerName={fullName}
      bannerImageUrl={candidate.avatarUrl}
      title={nameWithAge(candidate)}
      subtitle={candidate.desiredJobTitle}
      metadata={metaLine([
        candidate.city,
        experienceLabel(candidate.experienceLevel),
        availabilityLabel(candidate),
      ])}
      chipsLabel="Compétences"
      chips={candidate.skills}
      chipsClassName={SKILL_CHIP}
      metric={salaryWishLabel(candidate.salaryMin, candidate.salaryMax)}
      description={candidate.bio}
      detailText="Voir le profil"
      detailLabel={`Voir le profil de ${fullName}`}
      onViewDetails={onViewProfile}
    />
  );
}
