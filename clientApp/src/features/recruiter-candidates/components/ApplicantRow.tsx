import type { OfferApplicantDto } from '@/api/generated';
import { metaLine } from '@/components/feed/labels';
import { Button } from '@/components/ui/button';
import type { ApplicantDecision } from '../useApplicants';
import { CandidateAvatar } from './CandidateAvatar';
import { availabilityLabel, experienceLabel } from '../labels';

interface ApplicantRowProps {
  applicant: OfferApplicantDto;
  decision: ApplicantDecision;
  pending: boolean;
  onOpen: () => void;
  onLike: () => void;
  onPass: () => void;
}

function decisionLabel(decision: NonNullable<ApplicantDecision>): string {
  return decision.kind === 'liked' ? 'Intérêt déjà enregistré' : 'Candidat déjà passé';
}

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
  const isDecided = decision !== null;

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm sm:gap-4 sm:p-5">
      <CandidateAvatar name={firstName} avatarUrl={applicant.picture} className="size-12 text-xl" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Voir le profil de ${firstName}`}
          className="cursor-pointer text-left font-heading text-base font-bold break-words text-ink underline-offset-4 hover:underline"
        >
          {firstName}
        </button>
        {desiredJobTitle !== null && desiredJobTitle !== '' && (
          <p className="truncate text-sm font-medium text-role">{desiredJobTitle}</p>
        )}
        {summary !== '' && <p className="truncate text-sm text-ink-muted">{summary}</p>}
        {decision !== null && (
          <p
            role="status"
            title={`Décision enregistrée le ${decision.at}`}
            className="mt-1 text-xs font-medium text-ink-muted"
          >
            {decisionLabel(decision)}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isDecided || pending}
        aria-label={isDecided ? `${firstName}, ${decisionLabel(decision!)}` : `Passer ${firstName}`}
        className="h-11 shrink-0 rounded-full px-4"
        onClick={onPass}
      >
        Passer
      </Button>
      <Button
        type="button"
        variant="role"
        size="lg"
        disabled={isDecided || pending}
        aria-label={isDecided ? `${firstName}, ${decisionLabel(decision!)}` : `Liker ${firstName}`}
        className="h-11 shrink-0 rounded-full px-4"
        onClick={onLike}
      >
        Liker
      </Button>
    </li>
  );
}
