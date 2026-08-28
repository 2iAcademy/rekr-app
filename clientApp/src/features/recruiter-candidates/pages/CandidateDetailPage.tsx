import { useEffect, useRef } from 'react';
import { Heart, X } from 'lucide-react';
import type { OfferApplicantDto } from '@/api/generated';
import { Button } from '@/components/ui/button';
import { SKILL_CHIP, TAG_CHIP } from '@/components/ui/chip-variants';
import { CandidateAvatar } from '../components/CandidateAvatar';
import { ChipList } from '@/components/feed/ChipList';
import { contractLabel, metaLine } from '@/components/feed/labels';
import { availabilityLabel, experienceLabel, remoteLabel } from '../labels';

interface CandidateDetailPageProps {
  candidate: OfferApplicantDto;
  /** Whether this recruiter has already answered this candidate. */
  liked?: boolean;
  /** The like is in flight. */
  pending?: boolean;
  onBack: () => void;
  onLike: () => void;
}

const SECTION_TITLE = 'text-xs font-semibold tracking-wider text-ink-muted uppercase';

/**
 * A rubric over an empty list would announce « Compétences, list, 0 items », so
 * the whole block goes when the list does. The projection is sparse by design:
 * only the first name is guaranteed.
 */
function TagSection({
  title,
  items,
  chipClassName = TAG_CHIP,
}: {
  title: string;
  items: readonly string[];
  chipClassName?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className={SECTION_TITLE}>{title}</h2>
      <ChipList label={title} items={items} chipClassName={chipClassName} />
    </section>
  );
}

/**
 * The profile of a candidate who applied to one of the recruiter's offers.
 *
 * Deliberately narrower than what the candidate sees of themselves: they have
 * shown interest, not agreed to be identified. No surname, no CV, no salary
 * expectation — those belong to a conversation that has not started yet.
 *
 * Presentational on purpose: the list, the request and the routing stay in
 * `OfferApplicantsPage`, which mounts this screen as one of its states rather
 * than as a route of its own.
 */
export function CandidateDetailPage({
  candidate,
  liked = false,
  pending = false,
  onBack,
  onLike,
}: CandidateDetailPageProps) {
  const { firstName } = candidate;

  // Names the landmark that takes the focus below, so opening the screen
  // announces whose profile it is and not just « region ».
  const screenLabel = firstName === '' ? 'Profil' : `Profil de ${firstName}`;

  const screenRef = useRef<HTMLElement>(null);

  /**
   * The button that opened this screen is unmounted by the switch, so without
   * this the focus falls back to the document body: nothing is announced, and
   * Tab restarts from the top of the document. The list takes the focus back on
   * the way out.
   *
   * The landmark rather than the heading: the close button sits above the
   * heading, so focusing the heading would leave the only way out behind a
   * Shift+Tab.
   */
  useEffect(() => {
    screenRef.current?.focus();
  }, []);

  const bio = candidate.bio?.trim() ?? '';
  const jobTitle = candidate.desiredJobTitle?.trim() ?? '';
  const remote = remoteLabel(candidate.remotePolicy);

  // A named `section` rather than a `main`: `AppShell` already owns the page's
  // `main` landmark and the `data-role` palette that scopes it.
  return (
    <section
      ref={screenRef}
      tabIndex={-1}
      aria-label={screenLabel}
      className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-background outline-none"
    >
      <header className="absolute top-0 right-0 left-0 z-10 flex h-12 items-center justify-between px-4 pt-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à la liste"
          className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-muted"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
        <p className="font-heading text-base font-bold text-ink">Profil</p>
        {/* Balances the button so the title stays optically centred. */}
        <span aria-hidden="true" className="size-9" />
      </header>

      <div className="flex h-44 shrink-0 items-center justify-center bg-role-gradient pt-12 sm:h-52">
        <CandidateAvatar
          name={firstName}
          avatarUrl={candidate.picture}
          className="size-24 shadow-md"
        />
      </div>

      <div className="relative -mt-5 flex flex-1 flex-col gap-6 rounded-t-3xl bg-background px-5 pt-6 pb-8 sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-balance break-words text-ink">
            {firstName}
          </h1>
          {jobTitle !== '' && (
            <p className="text-sm font-medium break-words text-role">{jobTitle}</p>
          )}
          <p className="text-sm break-words text-ink-muted">
            {metaLine([
              candidate.city,
              experienceLabel(candidate.experienceLevel),
              availabilityLabel(candidate.availability),
            ])}
          </p>
        </div>

        <TagSection title="Compétences" items={candidate.tags} chipClassName={SKILL_CHIP} />

        <TagSection
          title="Contrats recherchés"
          items={candidate.contractTypes.map(contractLabel)}
        />

        {remote !== null && (
          <section className="flex flex-col gap-1">
            <h2 className={SECTION_TITLE}>Télétravail</h2>
            <p className="text-sm leading-relaxed break-words text-ink">{remote}</p>
          </section>
        )}

        {bio !== '' && (
          <section className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE}>À propos</h2>
            {/* Never clamped: reading it in full is the whole reason this screen
                exists next to the list. */}
            <p className="text-sm leading-relaxed break-words text-ink-muted">{bio}</p>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex bg-gradient-to-t from-background from-40% via-background/85 to-transparent px-5 pt-8 pb-4 sm:px-8">
        <Button
          type="button"
          variant={liked ? 'outline' : 'role'}
          size="xl"
          disabled={liked || pending}
          className="flex-1 rounded-full"
          onClick={onLike}
        >
          <Heart aria-hidden="true" className="size-5 fill-current" />
          {liked ? 'Intérêt enregistré' : 'Liker'}
        </Button>
      </div>
    </section>
  );
}
