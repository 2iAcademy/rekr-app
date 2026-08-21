import { MessageCircle } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MatchPerson {
  name: string;
  avatarUrl?: string | null;
}

interface MatchPageProps {
  currentUser: MatchPerson;
  matchedProfile: MatchPerson;
  onContinue?: () => void;
  onWriteMessage?: () => void;
}

function Avatar({ person, className }: { person: MatchPerson; className?: string }) {
  const initial = person.name.trim().charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        'flex aspect-square items-center justify-center overflow-hidden rounded-full border-4 border-white/90 bg-white/20 font-heading text-3xl font-bold text-white shadow-xl',
        className,
      )}
    >
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt={person.name} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </div>
  );
}

/** Full-screen celebration displayed as soon as both parties like each other. */
export function MatchPage({
  currentUser,
  matchedProfile,
  onContinue,
  onWriteMessage,
}: MatchPageProps) {
  return (
    <main className="fixed inset-0 z-50 isolate flex min-h-dvh w-full overflow-y-auto bg-brand-strong-gradient text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 18%, white 0 3px, transparent 4px), radial-gradient(circle at 84% 12%, white 0 5px, transparent 6px), radial-gradient(circle at 92% 50%, white 0 3px, transparent 4px), radial-gradient(circle at 10% 70%, white 0 4px, transparent 5px), radial-gradient(circle at 74% 78%, white 0 3px, transparent 4px)',
        }}
      />

      <section className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-8 pb-8 sm:px-8">
        <div className="flex justify-center">
          <BrandMark className="w-20 drop-shadow-lg" />
        </div>

        <div className="mt-9 text-center">
          <p className="text-sm font-medium tracking-[0.2em] text-white/75 uppercase">
            Félicitations
          </p>
          <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            C&apos;est un match !
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/85">
            {`${matchedProfile.name} est aussi intéressé. Lance la conversation.`}
          </p>
        </div>

        <div
          className="relative mx-auto mt-12 flex w-full max-w-xs items-center justify-center"
          aria-label={`Match entre vous et ${matchedProfile.name}`}
        >
          <div
            className="absolute size-44 rounded-full border border-white/20 bg-white/10 blur-[1px]"
            aria-hidden="true"
          />
          <Avatar
            person={currentUser}
            className="relative z-10 -mr-5 size-32 rotate-[-6deg] sm:size-36"
          />
          <Avatar
            person={matchedProfile}
            className="relative z-20 -ml-5 size-32 rotate-[6deg] sm:size-36"
          />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 text-center">
          <p className="truncate text-sm font-semibold">Toi</p>
          <p className="truncate text-sm font-semibold">{matchedProfile.name}</p>
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-12">
          <Button
            type="button"
            variant="soft"
            size="xl"
            className="w-full text-brand-strong"
            onClick={onWriteMessage}
          >
            <MessageCircle className="size-5" />
            Écrire un message
          </Button>
          <button
            type="button"
            onClick={onContinue}
            className="flex h-13 cursor-pointer items-center justify-center rounded-2xl font-heading text-[0.95rem] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Continuer à swiper
          </button>
        </div>
      </section>
    </main>
  );
}
