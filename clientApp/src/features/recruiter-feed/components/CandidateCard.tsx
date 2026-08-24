import { ChevronRight } from 'lucide-react';
import { AvatarBanner } from '@/components/ui/avatar-banner';
import { Button } from '@/components/ui/button';
import { SKILL_CHIP } from '@/components/ui/chip-variants';
import {
  availabilityLabel,
  experienceLabel,
  metaLine,
  nameWithAge,
  salaryWishLabel,
} from '../labels';
import type { FeedCandidate } from '../types';
import { ChipList } from './ChipList';

interface CandidateCardProps {
  candidate: FeedCandidate;
  onViewProfile: () => void;
}

export function CandidateCard({ candidate, onViewProfile }: CandidateCardProps) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-role">
      <AvatarBanner name={fullName} imageUrl={candidate.avatarUrl} />

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-bold text-balance break-words text-ink">
            {nameWithAge(candidate)}
          </h2>
          {candidate.desiredJobTitle.trim() !== '' && (
            <p className="text-sm font-medium text-role">{candidate.desiredJobTitle}</p>
          )}
          <p className="text-sm break-words text-ink-muted">
            {metaLine([
              candidate.city,
              experienceLabel(candidate.experienceLevel),
              availabilityLabel(candidate),
            ])}
          </p>
        </div>

        <ChipList label="Compétences" items={candidate.skills} chipClassName={SKILL_CHIP} />

        <p className="text-base font-bold break-words text-ink">
          {salaryWishLabel(candidate.salaryMin, candidate.salaryMax)}
        </p>

        {/* Always clamped: the card is a decision aid, the full bio belongs to
            the detail screen this button opens. */}
        {candidate.bio.trim() !== '' && (
          <p className="line-clamp-3 text-sm leading-relaxed break-words text-ink-muted">
            {candidate.bio}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          // Several cards can be on screen at once, and "Voir le profil" alone
          // would name them all the same.
          aria-label={`Voir le profil de ${fullName}`}
          onClick={onViewProfile}
          className="-ml-2.5 self-start text-brand hover:bg-brand-tint hover:text-brand-strong"
        >
          Voir le profil
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </article>
  );
}
