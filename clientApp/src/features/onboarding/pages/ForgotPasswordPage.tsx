import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authControllerForgotPassword } from '@/api/generated';
import { ApiError } from '@/api/customFetch';
import { passwordForgotBusiness } from '@/features/auth/authFeedback';
import { notifyFailure } from '@/lib/feedback/notify';

/**
 * The endpoint answers 204 for an unknown address, an inactive account and a
 * mail that could not be sent — the whole point being that none of them is
 * distinguishable from a delivered link, so all of them land on the
 * confirmation screen unchanged. What must not is a request the server never
 * answered on its merits (outage, throttle) and a payload it rejected outright:
 * a 400 means nothing was sent, and announcing a delivery would leave the user
 * waiting for a mail that will never come. Neither wording says anything about
 * the address existing.
 */
const blocksConfirmation = (cause: unknown): boolean =>
  !(cause instanceof ApiError) ||
  cause.status === 400 ||
  cause.status === 429 ||
  cause.status >= 500;

interface ForgotPasswordPageProps {
  onBack?: () => void;
  onSignIn?: () => void;
  onSubmit?: (data: { email: string }) => void;
}

export function ForgotPasswordPage({ onBack, onSignIn, onSubmit }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  // Announce the success state to screen readers on transition.
  useEffect(() => {
    if (submitted) {
      successHeadingRef.current?.focus();
    }
  }, [submitted]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // ForgotPasswordDto normalizes the address server-side; doing it again here
    // would only rewrite what the user sees for no gain.
    try {
      await authControllerForgotPassword({ email });
    } catch (caught) {
      if (blocksConfirmation(caught)) {
        notifyFailure(caught, passwordForgotBusiness);
        return;
      }
    }

    onSubmit?.({ email });
    setSubmitted(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-6 pt-4 pb-8">
      <header className="relative flex h-9 items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="absolute left-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-heading text-base font-bold text-ink">Mot de passe oublié</h1>
      </header>

      {submitted ? (
        <div className="mt-10 flex flex-col gap-1.5" role="status">
          <h2
            ref={successHeadingRef}
            tabIndex={-1}
            className="font-heading text-2xl font-bold text-ink outline-none"
          >
            Email envoyé.
          </h2>
          <p className="text-sm text-ink-muted">
            Si un compte est associé à <span className="font-medium text-ink">{email}</span>, vous
            recevez un lien pour réinitialiser votre mot de passe. Pensez à vérifier vos spams.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-4 cursor-pointer self-start text-sm font-medium text-role-strong hover:underline"
          >
            Modifier l'email
          </button>
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-col gap-1.5">
            <h2 className="font-heading text-2xl font-bold text-ink">Pas de panique.</h2>
            <p className="text-sm text-ink-muted">
              Saisissez votre email, on vous envoie un lien pour le réinitialiser.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="forgot-email" className="text-xs text-ink-muted">
                Email
              </label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nom@email.com"
              />
            </div>

            <Button type="submit" variant="role" size="xl" className="mt-1 w-full">
              Envoyer le lien
            </Button>
          </form>
        </>
      )}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-sm text-ink-muted">
        Vous vous en souvenez ?
        <button
          type="button"
          onClick={onSignIn}
          className="cursor-pointer font-medium text-role-strong hover:underline"
        >
          Connexion
        </button>
      </p>
    </main>
  );
}
