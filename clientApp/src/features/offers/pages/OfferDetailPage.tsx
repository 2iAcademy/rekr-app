import { ArrowLeft, Check, Heart, HeartHandshake, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import {
  offerControllerFindOneById,
  offerControllerLike,
  offerControllerPass,
  offerControllerUnlike,
} from '@/api/generated';
import type { OfferDetailDto, TagCategory } from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import { ChipList } from '@/components/feed/ChipList';
import { contractLabel, metaLine, offerSalaryLabel } from '@/components/feed/labels';
import { AvatarBanner } from '@/components/ui/avatar-banner';
import { Button } from '@/components/ui/button';
import { SKILL_CHIP } from '@/components/ui/chip-variants';
import { MarkdownText } from '@/components/ui/markdown-text';
import { SectionTitle } from '@/components/ui/section-title';
import { EXPERIENCE_LEVEL_OPTIONS, REMOTE_POLICY_OPTIONS } from '@/domain/options';
import { likeFailureBusiness } from '@/features/candidate-feed/likeFeedback';
import { matchedCompany } from '@/features/matches/likeResult';
import type { BusinessMessages } from '@/lib/feedback/failureMessage';
import { notifyFailure, notifySuccess } from '@/lib/feedback/notify';
import { fileUrl } from '@/lib/fileUrl';
import { cn } from '@/lib/utils';
import { FactList } from '@/components/ui/fact-list';

const UNLIKE_CONFLICT = 'Ce like ne peut plus être retiré.';

const serverMessage = (cause: unknown): string | undefined => {
  const body = cause instanceof ApiError ? cause.data : null;

  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return undefined;
  }

  const { message } = body as { message: unknown };

  return typeof message === 'string' ? message : undefined;
};

/**
 * A 409 on the withdrawal means a match was made in the meantime — a race the
 * reader lost while the screen was open. The server names the reason, and it
 * names it better than a generic failure would.
 */
const unlikeFailure = (cause: unknown): BusinessMessages => ({
  409: serverMessage(cause) ?? UNLIKE_CONFLICT,
});

interface MatchedProfile {
  name: string;
  avatarUrl: string | null;
}

interface OfferDetailPageProps {
  onBack?: () => void;
  onPass?: () => void;
  onMatch?: (matchedProfile: MatchedProfile) => void;
}

/** Same wording as the feed card: an empty field is said, not left blank. */
const NOT_SPECIFIED = 'Non précisé';

const labelOf = <T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | null,
): string =>
  value === null
    ? NOT_SPECIFIED
    : (options.find((option) => option.value === value)?.label ?? NOT_SPECIFIED);

function TopBar({ onBack }: { onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-1 bg-background px-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Fermer"
        className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
      </button>
      <h1 className="text-base font-bold text-ink">Détail</h1>
    </header>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 p-5">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

/**
 * A decision already taken, shown where the buttons would be: the same size as
 * them, so the bar does not jump, but not a control — there is nothing to press.
 */
function SettledDecision({ tone, children }: { tone: 'match' | 'neutral'; children: ReactNode }) {
  return (
    <p
      className={cn(
        'flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-center text-[0.9375rem] font-bold',
        tone === 'match'
          ? 'border-transparent bg-brand-tint text-brand-strong'
          : 'border-line bg-card text-ink',
      )}
    >
      {tone === 'match' ? (
        <HeartHandshake aria-hidden="true" className="size-5 shrink-0" />
      ) : (
        <Check aria-hidden="true" className="size-5 shrink-0 text-success" />
      )}
      {children}
    </p>
  );
}

export function OfferDetailPage({ onBack, onPass, onMatch }: OfferDetailPageProps) {
  const { id } = useParams();
  const [offer, setOffer] = useState<OfferDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isPassing, setIsPassing] = useState(false);
  const [isUnliking, setIsUnliking] = useState(false);

  useEffect(() => {
    const fetchOffer = async () => {
      try {
        const res = await offerControllerFindOneById(Number(id));
        setOffer(res.data);
      } catch (err) {
        console.error(err);
        setError('Offre introuvable.');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) {
      fetchOffer();
    }
  }, [id]);

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
        <TopBar onBack={onBack} />
        <div className="flex flex-col gap-3 px-4 pb-6">
          <p role="status" className="sr-only">
            Chargement…
          </p>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <div className="h-36 animate-pulse rounded-2xl bg-surface" />
            <div className="h-44 animate-pulse rounded-2xl bg-surface" />
            <div className="h-28 animate-pulse rounded-2xl bg-surface" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !offer) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
        <TopBar onBack={onBack} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <p role="alert" className="text-[0.9375rem] font-bold text-ink">
            {error ?? 'Offre introuvable.'}
          </p>
          <p className="mt-1 text-sm text-ink-muted">Elle a peut-être été retirée entre-temps.</p>
        </div>
      </main>
    );
  }

  const pass = async (): Promise<void> => {
    setIsPassing(true);
    try {
      await offerControllerPass(offer.id);
      onPass?.();
    } catch (cause) {
      notifyFailure(cause, likeFailureBusiness);
    } finally {
      setIsPassing(false);
    }
  };
  const like = async (): Promise<void> => {
    setIsLiking(true);
    try {
      const response = await offerControllerLike(offer.id);
      const counterpart = matchedCompany(response.data);
      if (counterpart) {
        onMatch?.({ name: counterpart.name, avatarUrl: counterpart.avatarUrl });
        return;
      }
      // No match yet: the interest is recorded, so the screen says so and moves
      // to the liked state the server now holds (a like replaces a pass).
      setOffer((current) => (current ? { ...current, liked: true, passed: false } : current));
      notifySuccess(`Intérêt envoyé à ${offer.company.name}.`);
    } catch (cause) {
      notifyFailure(cause, likeFailureBusiness);
    } finally {
      setIsLiking(false);
    }
  };
  const unlike = async (): Promise<void> => {
    setIsUnliking(true);
    try {
      await offerControllerUnlike(offer.id);
      onBack?.();
    } catch (cause) {
      notifyFailure(cause, unlikeFailure(cause));
    } finally {
      setIsUnliking(false);
    }
  };

  const { company, tags, city } = offer;
  // The three keys are served to the candidate alone: on a recruiter's read they
  // are absent, which is not the same answer as `false` and must not read as one.
  // A match does not erase the like, so `matched` is read first: taken the other
  // way round, the screen would offer a withdrawal the server refuses.
  const matched = offer.matched === true;
  const liked = !matched && offer.liked === true;
  const passed = !matched && offer.passed === true;
  const companyLogoUrl = fileUrl(company.logo);
  const labelsOf = (...categories: TagCategory[]) =>
    tags.filter((tag) => categories.includes(tag.category)).map((tag) => tag.label);
  const stack = labelsOf('skill', 'tech');
  const benefits = labelsOf('benefit');
  const contract = offer.contractType === null ? null : contractLabel(offer.contractType);
  const facts = [
    { label: 'Contrat', value: contract ?? NOT_SPECIFIED },
    { label: 'Télétravail', value: labelOf(REMOTE_POLICY_OPTIONS, offer.remotePolicy) },
    { label: 'Expérience', value: labelOf(EXPERIENCE_LEVEL_OPTIONS, offer.minExperienceLevel) },
    { label: 'Salaire', value: offerSalaryLabel(offer.salaryMin, offer.salaryMax) },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
      <TopBar onBack={onBack} />

      <div className="flex flex-1 flex-col px-4 pb-6">
        {/* One card for the whole offer — who, what, the facts, then the
            sections — split by hairlines rather than stacked as separate
            objects. */}
        <div className="divide-y divide-line rounded-2xl border border-line bg-card shadow-card">
          <section className="p-5">
            <div className="flex items-center gap-3">
              <AvatarBanner name={company.name} imageUrl={companyLogoUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{company.name}</p>
                <p className="truncate text-xs text-ink-muted">{metaLine([company.size, city])}</p>
              </div>
            </div>
            <h2 className="mt-4 text-xl leading-tight font-extrabold break-words text-ink sm:text-2xl">
              {offer.title}
            </h2>
          </section>

          <section aria-label="En bref" className="px-5 py-2">
            <FactList facts={facts} />
          </section>

          {stack.length > 0 && (
            <SectionCard title="Compétences">
              <ChipList label="Compétences" items={stack} chipClassName={SKILL_CHIP} />
            </SectionCard>
          )}

          {benefits.length > 0 && (
            <SectionCard title="Avantages">
              <ChipList label="Avantages" items={benefits} chipClassName={SKILL_CHIP} />
            </SectionCard>
          )}

          {offer.description && (
            <SectionCard title="À propos du poste">
              <MarkdownText source={offer.description} />
            </SectionCard>
          )}

          {company.description && (
            <SectionCard title="À propos de l'entreprise">
              <MarkdownText source={company.description} />
            </SectionCard>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-card px-4 py-3 md:bottom-4 md:mx-4 md:mb-4 md:rounded-2xl md:border md:px-5 md:shadow-float md:float-bar">
        {matched ? (
          <SettledDecision tone="match">Cette offre a donné lieu à un match</SettledDecision>
        ) : liked ? (
          <>
            <SettledDecision tone="neutral">Vous avez liké cette offre</SettledDecision>
            <Button
              type="button"
              variant="ghost"
              size="xl"
              className="w-full text-ink-muted hover:bg-surface hover:text-ink"
              onClick={() => void unlike()}
              disabled={isUnliking}
            >
              Retirer mon like
            </Button>
          </>
        ) : (
          <>
            {passed && (
              <p className="text-center text-sm text-ink-muted">Vous avez passé cette offre</p>
            )}
            <div
              role="group"
              aria-label="Décision sur l'offre"
              className={cn('grid gap-3', passed ? 'grid-cols-1' : 'grid-cols-2')}
            >
              {/* Passing again is a no-op; liking after a pass is a change of
                  mind the reader is entitled to. */}
              {!passed && (
                <Button
                  type="button"
                  variant="outline"
                  size="xl"
                  className="w-full"
                  onClick={() => void pass()}
                  disabled={isPassing}
                >
                  <X aria-hidden="true" />
                  Passer
                </Button>
              )}
              <Button
                type="button"
                variant="brand"
                size="xl"
                className="w-full"
                onClick={() => void like()}
                disabled={isLiking}
              >
                <Heart aria-hidden="true" />
                Ça m&apos;intéresse
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
