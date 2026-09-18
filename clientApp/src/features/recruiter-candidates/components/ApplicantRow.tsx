import type { OfferApplicantDto } from '@/api/generated';
import { metaLine } from '@/components/feed/labels';
import { Button } from '@/components/ui/button';
import { CandidateAvatar } from './CandidateAvatar';
import { availabilityLabel, experienceLabel } from '../labels';

interface ApplicantRowProps {
  applicant: OfferApplicantDto;
  /** This recruiter has already answered this candidate. */
  liked: boolean;
  /** The like is in flight. */
  pending: boolean;
  onOpen: () => void;
  onLike: () => void;
}

/**
 * One candidate in the list of those who applied to an offer. Purely
 * presentational: it owns neither the request nor its outcome.
 *
 * The name opens the profile rather than the whole row being clickable: the
 * like button sits inside, and nesting an action inside a control is neither
 * valid markup nor operable from a keyboard.
 */
export function ApplicantRow({ applicant, liked, pending, onOpen, onLike }: ApplicantRowProps) {
  const { firstName, desiredJobTitle, city } = applicant;
  const summary = metaLine([
    city,
    experienceLabel(applicant.experienceLevel),
    availabilityLabel(applicant.availability),
  ]);

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
      </div>

      <Button
        type="button"
        variant={liked ? 'outline' : 'role'}
        size="lg"
        disabled={liked || pending}
        aria-label={liked ? `${firstName}, intérêt enregistré` : `Liker ${firstName}`}
        className="h-11 shrink-0 rounded-full px-4"
        onClick={onLike}
      >
        {liked ? 'Enregistré' : 'Liker'}
      </Button>
    </li>
  );
}
