import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { notifyFailure } from '@/lib/feedback/notify';
import { applicantLikeBusiness } from '../applicantFeedback';
import { matchedCandidate } from '@/features/matches/likeResult';
import { ApplicantRow } from '../components/ApplicantRow';
import { CandidateDetailPage } from './CandidateDetailPage';
import { APPLICANTS_PAGE_SIZE, useApplicants } from '../useApplicants';

interface OfferApplicantsPageProps {
  offerId: number;
  /** Candidate whose profile is open, from the URL. `null` closes it. */
  openApplicantId: number | null;
  onOpenProfile: (candidateUserId: number) => void;
  onCloseProfile: () => void;
  onMatch: (matchedProfile: { name: string; avatarUrl: string | null }) => void;
}

const OFFERS_PATH = '/recruteur/offres';

/**
 * Who applied to one offer, and the profile of any of them.
 *
 * The profile is a state of this screen rather than a route of its own: the list
 * lives here, and a real route would unmount it and lose the likes just given.
 * Which one is open comes from the URL, so the browser back button closes it.
 */
export function OfferApplicantsPage({
  offerId,
  openApplicantId,
  onOpenProfile,
  onCloseProfile,
  onMatch,
}: OfferApplicantsPageProps) {
  const { applicants, status, truncated, pendingId, reload, like, pass, decisionFor } =
    useApplicants(offerId);

  const answer = (candidateUserId: number): void => {
    void like(candidateUserId)
      .then((result) => {
        const counterpart = matchedCandidate(result);
        if (counterpart) {
          onMatch({ name: counterpart.name, avatarUrl: counterpart.avatarUrl });
        }
      })
      .catch((cause: unknown) => notifyFailure(cause, applicantLikeBusiness));
  };

  const passApplicant = (candidateUserId: number): void => {
    void pass(candidateUserId).catch((cause: unknown) =>
      notifyFailure(cause, applicantLikeBusiness),
    );
  };

  const open = applicants.find((applicant) => applicant.userId === openApplicantId);

  // An id naming nobody closes the profile instead of rendering an empty
  // screen: the candidate may have been answered, or the URL simply typed.
  if (open !== undefined) {
    return (
      <CandidateDetailPage
        candidate={open}
        decision={decisionFor(open.userId)}
        pending={pendingId === open.userId}
        onBack={onCloseProfile}
        onLike={() => answer(open.userId)}
        onPass={() => passApplicant(open.userId)}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 md:mx-0 lg:max-w-4xl xl:max-w-5xl">
      <Link
        to={OFFERS_PATH}
        className="inline-flex items-center gap-2 self-start text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Vos offres
      </Link>

      <h1 className="font-heading text-xl font-bold text-ink md:text-2xl">Candidats intéressés</h1>

      {status === 'loading' && <p className="text-sm text-ink-muted">Chargement…</p>}

      {status === 'missing' && (
        <p className="text-sm text-ink-muted">
          Cette offre est introuvable. Elle a peut-être été supprimée.
        </p>
      )}

      {status === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          Impossible de charger les candidats.{' '}
          <button type="button" onClick={reload} className="cursor-pointer underline">
            Réessayer
          </button>
        </p>
      )}

      {status === 'ready' && applicants.length === 0 && (
        // Not a failure and not an invitation to act: the offer is published,
        // there is nothing to do but wait.
        <div className="rounded-2xl border border-dashed border-line bg-card p-6">
          <p className="text-sm text-ink-muted">
            Personne n’a encore manifesté d’intérêt pour cette offre.
          </p>
        </div>
      )}

      {status === 'ready' && truncated && (
        // Said out loud rather than left to be guessed: a recruiter reading a
        // full page has no way to tell it from the whole list.
        <p role="note" className="text-sm text-ink-muted">
          Seuls les {APPLICANTS_PAGE_SIZE} candidats les plus récents sont affichés ; il en existe
          d’autres.
        </p>
      )}

      {status === 'ready' && applicants.length > 0 && (
        <ul aria-label="Candidats intéressés par cette offre" className="flex flex-col gap-3">
          {applicants.map((applicant) => (
            <ApplicantRow
              key={applicant.userId}
              applicant={applicant}
              decision={decisionFor(applicant.userId)}
              pending={pendingId === applicant.userId}
              onOpen={() => onOpenProfile(applicant.userId)}
              onLike={() => answer(applicant.userId)}
              onPass={() => passApplicant(applicant.userId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
