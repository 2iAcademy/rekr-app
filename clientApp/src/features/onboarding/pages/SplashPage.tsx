import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';

const matchCountFormatter = new Intl.NumberFormat('fr-FR');

interface SplashPageProps {
  onCreateAccount?: () => void;
  onSignIn?: () => void;
  weeklyMatches?: number;
}

export function SplashPage({ onCreateAccount, onSignIn, weeklyMatches = 0 }: SplashPageProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-8 pt-14 pb-8">
      <div className="flex flex-col items-center">
        <Logo size="lg" orientation="vertical" glow />
      </div>

      <section className="mt-12 flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-brand-tint px-4 py-3.5">
          <span className="size-2.5 shrink-0 rounded-full bg-brand" />
          <p className="text-sm text-ink">
            <span className="font-semibold">Candidat</span>, trouve le job qui te ressemble.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-violet-tint px-4 py-3.5">
          <span className="size-2.5 shrink-0 rounded-full bg-violet" />
          <p className="text-sm text-ink">
            <span className="font-semibold">Recruteur</span>, trouve le talent qui colle.
          </p>
        </div>

        {weeklyMatches > 0 && (
          <p className="mt-1 text-center text-xs text-ink-faint">
            Déjà {matchCountFormatter.format(weeklyMatches)}{' '}
            {weeklyMatches > 1 ? 'matchs' : 'match'} cette semaine
          </p>
        )}
      </section>

      <section className="mt-auto flex flex-col gap-3">
        <Button variant="brand" size="xl" className="w-full" onClick={onCreateAccount}>
          Créer un compte
        </Button>
        <Button variant="soft" size="xl" className="w-full" onClick={onSignIn}>
          J'ai déjà un compte
        </Button>

        <p className="mt-2 text-center text-xs leading-snug text-ink-faint">
          En continuant, vous acceptez les CGU et la politique de confidentialité.
        </p>
      </section>
    </main>
  );
}
