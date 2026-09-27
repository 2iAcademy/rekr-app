import { Check, ChevronRight, Heart, X } from 'lucide-react';
import type { OfferApplicantDto } from '@/api/generated';
import { metaLine } from '@/components/feed/labels';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ApplicantDecision } from '../useApplicants';
import { CandidateAvatar } from './CandidateAvatar';
import { availabilityLabel, experienceLabel } from '../labels';

interface ApplicantRowProps {
  applicant: OfferApplicantDto;
  /** This recruiter's saved answer to this candidate, if any. */
  decision: ApplicantDecision;
  /** A decision write is in flight. */
  pending: boolean;
  onOpen: () => void;
  onLike: () => void;
  onPass: () => void;
}

function decisionLabel(decision: NonNullable<ApplicantDecision>): string {
  return decision.kind === 'liked' ? 'Intérêt déjà enregistré' : 'Candidat déjà passé';
}

const ROUND_ACTION = 'relative z-10 size-11 shrink-0 rounded-full p-0';

/**
 * One candidate in the list of those who applied to an offer. Purely
 * presentational: it owns neither the request nor its outcome.
 *
 * The name is the control that opens the profile; its hit area is stretched
 * over the whole row with a pseudo-element, and the actions are lifted above
 * it. That makes the row clickable without nesting an action inside a control,
 * which would be neither valid markup nor operable from a keyboard.
 */
export function ApplicantRow({
  applicant,
  decision,
  pending,
  onOpen,
  onLike,
  onPass,
}: ApplicantRowProps) {
  const { firstName, desiredJobTitle, city } = applicant;
  const summary = metaLine([
    city,
    experienceLabel(applicant.experienceLevel),
    availabilityLabel(applicant.availability),
  ]);

  return (
    <li className="relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface/60 sm:gap-4 sm:px-5">
      <CandidateAvatar
        name={firstName}
        avatarUrl={applicant.picture}
        className="size-11 text-base"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Voir le profil de ${firstName}`}
          className="cursor-pointer self-start rounded-md text-left text-[0.9375rem] font-bold break-words text-ink outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:ring-3 focus-visible:ring-brand/30"
        >
          {firstName}
        </button>
        {desiredJobTitle !== null && desiredJobTitle !== '' && (
          <p className="truncate text-sm font-medium text-ink-soft">{desiredJobTitle}</p>
        )}
        {summary !== '' && <p className="truncate text-sm text-ink-muted">{summary}</p>}
        {decision !== null && (
          <p
            role="status"
            title={`Décision enregistrée le ${decision.at}`}
            className="mt-0.5 text-xs font-medium text-ink-muted"
          >
            {decisionLabel(decision)}
          </p>
        )}
      </div>

      {/* Round icon controls rather than labelled buttons: repeated on every
          row, filled buttons would outweigh the candidates they sit next to.
          The accessible names carry the words the icons leave out. */}
      {decision === null ? (
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            aria-label={`Passer : ${firstName}`}
            className={cn(
              ROUND_ACTION,
              'border border-line bg-card text-ink-muted hover:bg-surface hover:text-ink',
            )}
            onClick={onPass}
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            aria-label={`Ça m'intéresse : ${firstName}`}
            className={cn(
              ROUND_ACTION,
              'bg-brand-tint text-brand-strong hover:bg-brand hover:text-white',
            )}
            onClick={onLike}
          >
            <Heart aria-hidden="true" className="size-5" />
          </Button>
        </div>
      ) : (
        // An answered candidate is a settled state, not an unavailable action:
        // one mark that stays fully legible instead of two fading buttons.
        <Button
          type="button"
          variant="ghost"
          disabled
          aria-label={
            decision.kind === 'liked'
              ? `${firstName}, intérêt enregistré`
              : `${firstName}, candidat passé`
          }
          className={cn(
            ROUND_ACTION,
            'disabled:opacity-100',
            decision.kind === 'liked'
              ? 'bg-success-tint text-success'
              : 'bg-surface text-ink-muted',
          )}
        >
          {decision.kind === 'liked' ? (
            <Check aria-hidden="true" className="size-5" />
          ) : (
            <X aria-hidden="true" className="size-5" />
          )}
        </Button>
      )}

      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-faint" />
    </li>
  );
}
