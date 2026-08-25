import { useEffect, useRef } from 'react';
import { ExternalLink, FileText, Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SKILL_CHIP, TAG_CHIP } from '@/components/ui/chip-variants';
import { fileUrl } from '@/lib/fileUrl';
import { CandidateAvatar } from '../components/CandidateAvatar';
import { ChipList } from '@/components/feed/ChipList';
import { contractLabel, metaLine } from '@/components/feed/labels';
import {
  availabilityLabel,
  experienceLabel,
  mobilityLabel,
  nameWithAge,
  remoteLabel,
  salaryWishLabel,
} from '../labels';
import type { FeedCandidate } from '../types';

interface CandidateDetailPageProps {
  candidate: FeedCandidate;
  onBack: () => void;
  onPass: () => void;
  onLike: () => void;
}

const SECTION_TITLE = 'text-xs font-semibold tracking-wider text-ink-muted uppercase';
const LINK =
  'inline-flex items-center gap-2 self-start text-sm font-medium text-role underline underline-offset-4';

/**
 * A rubric over an empty list would announce "Langues, list, 0 items", so the
 * whole block goes when the list does. The API will serve incomplete profiles
 * (#135); the mocked deck never shows one.
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

function TextSection({ title, children }: { title: string; children: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className={SECTION_TITLE}>{title}</h2>
      <p className="text-sm leading-relaxed break-words text-ink">{children}</p>
    </section>
  );
}

/**
 * Recruiter-side counterpart of `OfferDetailPage` (#45): the full profile behind
 * a card of the feed, shown before the like is worth anything.
 *
 * Presentational on purpose — the deck, the decisions and the routing stay in
 * `RecruiterFeedPage`, which mounts this screen as one of its states rather than
 * as a route of its own.
 */
export function CandidateDetailPage({
  candidate,
  onBack,
  onPass,
  onLike,
}: CandidateDetailPageProps) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  // Normalised rather than compared to `null`: an empty string is a valid
  // `string | null`, and the API is free to send one.
  const linkedinUrl = candidate.linkedinUrl?.trim() || null;
  const portfolioUrl = candidate.portfolioUrl?.trim() || null;
  const cvHref = fileUrl(candidate.cvUrl?.trim() || null);
  const hasLinks = linkedinUrl !== null || portfolioUrl !== null || cvHref !== null;

  // Names the landmark that takes the focus below, so opening the screen
  // announces whose profile it is and not just "region".
  const screenLabel = fullName === '' ? 'Profil' : `Profil de ${fullName}`;

  const screenRef = useRef<HTMLElement>(null);

  /**
   * The button that opened this screen is unmounted by the switch, so without
   * this the focus falls back to the document body: nothing is announced, and
   * Tab restarts from the top of the document. The feed already takes the focus
   * back on the way out.
   *
   * The landmark rather than the heading: the close button sits above the
   * heading, so focusing the heading would leave the only way out behind a
   * Shift+Tab. A deep link is served the same way — the focus is on the body at
   * page load anyway, so there is nothing to steal, and the screen still has to
   * name itself.
   */
  useEffect(() => {
    screenRef.current?.focus();
  }, []);

  const mobility = mobilityLabel(candidate);
  const bio = candidate.bio.trim();
  const jobTitle = candidate.desiredJobTitle.trim();

  // A named `section` rather than a `main`: `AppDrawer` already owns the page's
  // `main` landmark and its `data-role` palette. Named, it is still a landmark,
  // so focusing it announces whose profile is on screen.
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
          aria-label="Retour au feed"
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
          name={fullName}
          avatarUrl={candidate.avatarUrl}
          className="size-24 shadow-md"
        />
      </div>

      <div className="relative -mt-5 flex flex-1 flex-col gap-6 rounded-t-3xl bg-background px-5 pt-6 pb-8 sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold text-balance break-words text-ink">
            {nameWithAge(candidate)}
          </h1>
          {jobTitle !== '' && (
            <p className="text-sm font-medium break-words text-role">{jobTitle}</p>
          )}
          <p className="text-sm break-words text-ink-muted">
            {metaLine([
              candidate.city,
              experienceLabel(candidate.experienceLevel),
              availabilityLabel(candidate),
            ])}
          </p>
        </div>

        {/* No rubric, like the card: "Prétention salariale / Prétention non
            communiquée" would say the same thing twice. */}
        <p className="text-base font-bold break-words text-ink">
          {salaryWishLabel(candidate.salaryMin, candidate.salaryMax)}
        </p>

        <TagSection title="Compétences" items={candidate.skills} chipClassName={SKILL_CHIP} />

        <TagSection
          title="Contrats recherchés"
          items={candidate.contractTypes.map(contractLabel)}
        />

        <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
          <TextSection title="Télétravail">{remoteLabel(candidate.remotePolicy)}</TextSection>
          {mobility !== null && <TextSection title="Mobilité">{mobility}</TextSection>}
        </div>

        <TagSection title="Langues" items={candidate.languages} />

        {bio !== '' && (
          <section className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE}>À propos</h2>
            {/* Never clamped: reading the bio in full is the whole reason this
                screen exists next to the card. */}
            <p className="text-sm leading-relaxed break-words text-ink-muted">{bio}</p>
          </section>
        )}

        {hasLinks && (
          <section className="flex flex-col gap-3">
            <h2 className={SECTION_TITLE}>Liens</h2>
            {linkedinUrl !== null && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Profil LinkedIn de ${fullName}`}
                className={LINK}
              >
                LinkedIn
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            )}
            {portfolioUrl !== null && (
              <a
                href={portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Portfolio de ${fullName}`}
                className={LINK}
              >
                Portfolio
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            )}
            {/* The backend serves no CV to a recruiter yet: `cv` is not publicly
                readable, and the only route that returns one is the owner's own
                `GET /api/candidate-profiles/me/cv`. The link is wired to the key
                the API will expose once the recruiter deck is real (#135); until
                then it is mock data pointing at a 404, like the rest of the deck. */}
            {cvHref !== null && (
              <a
                href={cvHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`CV de ${fullName}`}
                className={LINK}
              >
                CV
                <FileText aria-hidden="true" className="size-4" />
              </a>
            )}
          </section>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex gap-3 bg-gradient-to-t from-background from-40% via-background/85 to-transparent px-5 pt-8 pb-4 sm:px-8">
        <Button
          type="button"
          variant="outline"
          size="xl"
          className="flex-1 rounded-full"
          onClick={onPass}
        >
          Passer
        </Button>
        <Button
          type="button"
          variant="role"
          size="xl"
          className="flex-1 rounded-full"
          onClick={onLike}
        >
          <Heart aria-hidden="true" className="size-5 fill-current" />
          Liker
        </Button>
      </div>
    </section>
  );
}
