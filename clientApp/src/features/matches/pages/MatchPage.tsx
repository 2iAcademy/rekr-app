import { Building2, Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fileUrl } from '@/lib/fileUrl';
import { FactList } from '@/components/ui/fact-list';

interface MatchPerson {
  name: string;
  avatarUrl?: string | null;
}

interface MatchOffer {
  title: string;
  contract?: string | null;
  city?: string | null;
}

interface MatchPageProps {
  currentUser: MatchPerson;
  /** Absent when the screen is opened without knowing who matched. */
  matchedProfile?: MatchPerson | null;
  offer?: MatchOffer | null;
  onContinue?: () => void;
  onWriteMessage?: () => void;
}

/**
 * The avatars slide in towards each other and settle with an exponential
 * ease-out. Only under `motion-safe`: with reduced motion they are simply there,
 * and in every case the resting state is the plain layout, so nothing depends
 * on the animation finishing.
 */
const SETTLE =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]';

/** A ready URL is kept as is; a storage key is turned into one. */
const avatarSrc = (avatarUrl: string | null | undefined): string | null =>
  avatarUrl?.startsWith('/') || avatarUrl?.startsWith('http') ? avatarUrl : fileUrl(avatarUrl);

function Avatar({ person, className }: { person: MatchPerson | null; className?: string }) {
  const initial = person?.name.trim().charAt(0).toUpperCase();
  const src = avatarSrc(person?.avatarUrl);

  return (
    <div
      className={cn(
        'flex size-22 shrink-0 items-center justify-center overflow-hidden rounded-full text-3xl font-extrabold shadow-raised ring-4 ring-white',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={person?.name ?? ''} className="size-full object-cover" />
      ) : initial ? (
        <span aria-hidden>{initial}</span>
      ) : (
        <Building2 aria-hidden="true" className="size-9" />
      )}
    </div>
  );
}

/** Full-screen moment displayed as soon as both parties like each other. */
export function MatchPage({
  currentUser,
  matchedProfile,
  offer,
  onContinue,
  onWriteMessage,
}: MatchPageProps) {
  const matchedName = matchedProfile?.name.trim() || null;
  const recap = offer
    ? [
        { label: 'Offre', value: offer.title },
        { label: 'Contrat', value: offer.contract },
        { label: 'Ville', value: offer.city },
      ].filter((row): row is { label: string; value: string } => Boolean(row.value?.trim()))
    : [];

  return (
    <main className="fixed inset-0 z-50 flex min-h-dvh w-full overflow-y-auto bg-card text-ink">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-16 pb-8 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <div
            role="group"
            aria-label={matchedName ? `Match entre vous et ${matchedName}` : 'Votre match'}
            className="flex items-center justify-center"
          >
            <Avatar
              person={currentUser}
              className={cn(
                'relative z-10 -mr-3 bg-amber-100 text-amber-900',
                SETTLE,
                'motion-safe:slide-in-from-left-6',
              )}
            />
            <Avatar
              person={matchedProfile ?? null}
              className={cn(
                '-ml-3 bg-brand-tint text-brand-strong',
                SETTLE,
                'motion-safe:slide-in-from-right-6',
              )}
            />
          </div>

          <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white motion-safe:animate-in motion-safe:fade-in motion-safe:delay-150 motion-safe:duration-300 motion-safe:fill-mode-both">
            <Heart aria-hidden="true" className="size-3.5 fill-current" />
            Intérêt réciproque
          </p>

          <h1 className="mt-4 text-[1.75rem] leading-tight font-extrabold break-words text-ink">
            {matchedName ? `${matchedName} a aussi retenu votre profil` : 'Nouveau match'}
          </h1>
          <p className="mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-ink-muted">
            Vous pouvez écrire dès maintenant pour lancer la conversation.
          </p>
        </div>

        {recap.length > 0 && (
          <FactList
            facts={recap}
            className="mt-8 rounded-2xl border border-line bg-card px-5 py-2 shadow-card"
          />
        )}

        <div className="mt-auto flex flex-col gap-2 pt-10">
          <Button
            type="button"
            variant="brand"
            size="xl"
            className="w-full"
            onClick={onWriteMessage}
          >
            <MessageCircle aria-hidden="true" />
            Écrire un message
          </Button>
          <Button type="button" variant="ghost" size="xl" className="w-full" onClick={onContinue}>
            Continuer à swiper
          </Button>
        </div>
      </section>
    </main>
  );
}
