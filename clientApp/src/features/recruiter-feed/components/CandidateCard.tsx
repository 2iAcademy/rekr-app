import { ArrowDown, ExternalLink } from 'lucide-react';
import { AvatarBanner } from '@/components/ui/avatar-banner';
import { Button } from '@/components/ui/button';
import { chipVariants } from '@/components/ui/chip-variants';
import { SectionTitle } from '@/components/ui/section-title';
import { cn } from '@/lib/utils';
import {
  availabilityLabel,
  contractLabel,
  experienceLabel,
  metaLine,
  nameWithAge,
  remoteLabel,
  salaryWishLabel,
} from '../labels';
import type { FeedCandidate } from '../types';

interface CandidateCardProps {
  candidate: FeedCandidate;
  isProfileOpen: boolean;
  onToggleProfile: () => void;
  profilePanelId: string;
}

// Green on both feeds, per the mock: the skills are the candidate's own words,
// not a recruiter-side accent. The detail panel keeps the role colour.
const SKILL_CHIP = chipVariants({ tone: 'brand' });
const TAG_CHIP = chipVariants({ tone: 'role' });

/**
 * Named on the list itself rather than by a heading: the card body carries no
 * visible rubric, but the group still has to be announced.
 */
function ChipList({
  label,
  items,
  chipClassName,
}: {
  label: string;
  items: readonly string[];
  chipClassName: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className={chipClassName}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * A section title over an empty list would announce "Langues, list, 0 items",
 * so the whole block goes when the list does. The API will serve incomplete
 * profiles (#135); the mocked deck never shows one.
 */
function TagSection({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>{title}</SectionTitle>
      <ChipList label={title} items={items} chipClassName={TAG_CHIP} />
    </div>
  );
}

export function CandidateCard({
  candidate,
  isProfileOpen,
  onToggleProfile,
  profilePanelId,
}: CandidateCardProps) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  // Normalised rather than compared to `null`: an empty string is a valid
  // `string | null`, and the API is free to send one.
  const linkedinUrl = candidate.linkedinUrl?.trim() || null;

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

        {candidate.bio.trim() !== '' && (
          <p
            className={cn(
              'text-sm leading-relaxed break-words text-ink-muted',
              !isProfileOpen && 'line-clamp-3',
            )}
          >
            {candidate.bio}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          aria-expanded={isProfileOpen}
          aria-controls={profilePanelId}
          onClick={onToggleProfile}
          className="-ml-2.5 self-start text-brand hover:bg-brand-tint hover:text-brand-strong"
        >
          Voir le profil
          <ArrowDown
            aria-hidden="true"
            className={cn('size-4 transition-transform', isProfileOpen && 'rotate-180')}
          />
        </Button>

        {isProfileOpen && (
          <div
            id={profilePanelId}
            role="group"
            aria-label={`Profil de ${fullName}`}
            className="flex flex-col gap-5 border-t border-line pt-5"
          >
            <TagSection
              title="Contrats recherchés"
              items={candidate.contractTypes.map(contractLabel)}
            />

            <div className="flex flex-col gap-1">
              <SectionTitle>Télétravail</SectionTitle>
              <p className="text-sm text-ink">{remoteLabel(candidate.remotePolicy)}</p>
            </div>

            <TagSection title="Langues" items={candidate.languages} />

            {linkedinUrl !== null && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Profil LinkedIn de ${fullName}`}
                className="inline-flex items-center gap-2 self-start text-sm font-medium text-role underline underline-offset-4"
              >
                LinkedIn
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
