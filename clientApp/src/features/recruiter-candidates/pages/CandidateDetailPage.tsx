import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, Heart, X } from 'lucide-react';
import type { OfferApplicantDto } from '@/api/generated';
import { Button } from '@/components/ui/button';
import { SKILL_CHIP, TAG_CHIP } from '@/components/ui/chip-variants';
import { SectionTitle } from '@/components/ui/section-title';
import { CandidateAvatar } from '../components/CandidateAvatar';
import { ChipList } from '@/components/feed/ChipList';
import { contractLabel } from '@/components/feed/labels';
import { availabilityLabel, experienceLabel, remoteLabel } from '../labels';
import type { ApplicantDecision } from '../useApplicants';
import { FactList } from '@/components/ui/fact-list';

interface CandidateDetailPageProps {
  candidate: OfferApplicantDto;
  /** Saved recruiter decision for this candidate, if any. */
  decision: ApplicantDecision;
  /** A decision write is in flight. */
  pending?: boolean;
  onBack: () => void;
  onLike: () => void;
  onPass: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 p-5 sm:p-6">
      <SectionTitle level={2}>{title}</SectionTitle>
      {children}
    </section>
  );
}

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
    <Section title={title}>
      <ChipList label={title} items={items} chipClassName={chipClassName} />
    </Section>
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
  decision,
  pending = false,
  onBack,
  onLike,
  onPass,
}: CandidateDetailPageProps) {
  const { firstName } = candidate;
  const isDecided = decision !== null;
  const decisionText =
    decision?.kind === 'liked' ? 'Intérêt déjà enregistré' : 'Candidat déjà passé';

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
   * The landmark rather than the heading: the back button sits above the
   * heading, so focusing the heading would leave the only way out behind a
   * Shift+Tab.
   */
  useEffect(() => {
    screenRef.current?.focus();
  }, []);

  const bio = candidate.bio?.trim() ?? '';
  const jobTitle = candidate.desiredJobTitle?.trim() ?? '';
  const city = candidate.city?.trim() ?? '';

  // Only what the candidate filled in: a row reading « non renseigné » would
  // look like a gap in the profile rather than a choice to leave it out.
  const facts = [
    { label: 'Expérience', value: experienceLabel(candidate.experienceLevel) },
    { label: 'Disponibilité', value: availabilityLabel(candidate.availability) },
    { label: 'Télétravail', value: remoteLabel(candidate.remotePolicy) },
  ].filter((fact): fact is { label: string; value: string } => fact.value !== null);

  // A named `section` rather than a `main`: `AppShell` already owns the page's
  // `main` landmark.
  return (
    <section
      ref={screenRef}
      tabIndex={-1}
      aria-label={screenLabel}
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 outline-none md:mx-0"
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          aria-label="Retour à la liste"
          className="-ml-2 size-11 rounded-xl p-0 text-ink hover:bg-surface hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Button>
        <p className="text-base font-bold text-ink">Profil</p>
      </div>

      {/* One card for the whole profile — identity, facts, then the sections —
          split by hairlines rather than stacked as separate objects. */}
      <div className="divide-y divide-line rounded-2xl border border-line bg-card shadow-card">
        <div className="flex items-center gap-4 p-5 sm:p-6">
          <CandidateAvatar
            name={firstName}
            avatarUrl={candidate.picture}
            className="size-16 text-2xl"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-2xl font-extrabold text-balance break-words text-ink">
              {firstName}
            </h1>
            {jobTitle !== '' && (
              <p className="text-sm font-semibold break-words text-ink-soft">{jobTitle}</p>
            )}
            {city !== '' && <p className="text-sm break-words text-ink-muted">{city}</p>}
          </div>
        </div>

        {facts.length > 0 && (
          <div className="px-5 py-2 sm:px-6">
            <FactList facts={facts} />
          </div>
        )}

        <TagSection title="Compétences" items={candidate.tags} chipClassName={SKILL_CHIP} />

        <TagSection
          title="Contrats recherchés"
          items={candidate.contractTypes.map(contractLabel)}
        />

        {bio !== '' && (
          <Section title="À propos">
            {/* Never clamped: reading it in full is the whole reason this screen
              exists next to the list. */}
            <p className="text-[0.9375rem] leading-relaxed break-words text-ink-soft">{bio}</p>
          </Section>
        )}
      </div>

      {/* Sticks above the phone tab bar; bleeds to the screen edges on phones,
          stays in the column from `md:`. */}
      <div className="sticky bottom-[var(--tabbar-h,0px)] z-10 -mx-4 flex flex-col gap-2 border-t border-line bg-card px-4 py-3 sm:-mx-6 sm:px-6 md:mx-0 md:flex-row md:items-center md:gap-4 md:rounded-2xl md:border md:px-5 md:shadow-card">
        {decision !== null && (
          <p
            role="status"
            title={`Décision enregistrée le ${decision.at}`}
            className="text-center text-sm font-medium text-ink-muted md:text-left"
          >
            {decisionText}
          </p>
        )}
        <div className="flex gap-3 md:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="xl"
            disabled={isDecided || pending}
            className="flex-1 md:flex-none"
            onClick={onPass}
          >
            <X aria-hidden="true" />
            Passer
          </Button>
          <Button
            type="button"
            variant="brand"
            size="xl"
            disabled={isDecided || pending}
            className="flex-1 md:flex-none"
            onClick={onLike}
          >
            <Heart aria-hidden="true" />
            {"Ça m'intéresse"}
          </Button>
        </div>
      </div>
    </section>
  );
}
