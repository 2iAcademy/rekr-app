import { Building2, Search, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';

const matchCountFormatter = new Intl.NumberFormat('fr-FR');

interface Side {
  icon: LucideIcon;
  who: string;
  gets: string;
}

// What each side finds once inside, in the same neutral dress: the product no
// longer paints candidates and recruiters in different colours.
const SIDES: readonly Side[] = [
  {
    icon: Search,
    who: 'Candidat',
    gets: 'Des offres d’entreprises de toutes tailles, à découvrir une par une.',
  },
  {
    icon: Building2,
    who: 'Recruteur',
    gets: 'Des profils proches de vos besoins, à découvrir un par un.',
  },
];

interface SplashPageProps {
  onCreateAccount?: () => void;
  onSignIn?: () => void;
  weeklyMatches?: number;
}

export function SplashPage({ onCreateAccount, onSignIn, weeklyMatches = 0 }: SplashPageProps) {
  return (
    <main className="flex min-h-dvh w-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-14 pb-[max(2rem,env(safe-area-inset-bottom))] md:justify-center md:py-12">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" orientation="vertical" showMark />
          <h1 className="mt-8 text-2xl leading-tight font-extrabold text-ink">
            Le match naît d’un intérêt réciproque.
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-pretty text-ink-muted">
            Candidats et entreprises se découvrent. Quand les deux disent oui, c’est un match.
          </p>
        </div>

        <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-card shadow-card">
          {SIDES.map(({ icon: Icon, who, gets }) => (
            <li key={who} className="flex items-center gap-4 px-4 py-4">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-strong"
              >
                <Icon className="size-5" />
              </span>
              <p className="text-sm leading-snug text-ink-muted">
                <span className="block font-bold text-ink">{who}</span>
                {gets}
              </p>
            </li>
          ))}
        </ul>

        {weeklyMatches > 0 && (
          <p className="tabular mt-4 text-center text-sm text-ink-muted">
            Déjà {matchCountFormatter.format(weeklyMatches)}{' '}
            {weeklyMatches > 1 ? 'matchs' : 'match'} cette semaine
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-10 md:mt-10 md:pt-0">
          <Button variant="brand" size="xl" className="w-full" onClick={onCreateAccount}>
            Créer un compte
          </Button>
          <Button variant="outline" size="xl" className="w-full" onClick={onSignIn}>
            J'ai déjà un compte
          </Button>

          <p className="mt-2 text-center text-xs leading-snug text-ink-muted">
            En continuant, vous acceptez les CGU et la politique de confidentialité.
          </p>
        </div>
      </div>
    </main>
  );
}
